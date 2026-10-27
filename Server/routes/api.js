var express = require('express');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Election = require('../models/Election');
var Voter = require('../models/Voter');
var parseExternalVote = require('../lib/externalVote');

var router = express.Router();

function requireDatabase(res) {
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  res.status(503).json({ error: 'La base de datos no está disponible.' });
  return false;
}

function safeEqual(first, second) {
  var firstBuffer = Buffer.from(first);
  var secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function requireApiKey(req, res, next) {
  var expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) {
    return res.status(503).json({ error: 'La API externa no está configurada.' });
  }
  var submittedKey = req.get('x-api-key') || '';
  if (!safeEqual(submittedKey, expectedKey)) {
    return res.status(401).json({ error: 'La clave de API no es válida.' });
  }
  return next();
}

function publicElection(election) {
  return {
    id: election._id,
    title: election.title,
    description: election.description,
    startsAt: election.startsAt,
    endsAt: election.endsAt,
    candidates: election.candidates.map(function(candidate) {
      return {
        id: candidate._id,
        name: candidate.name,
        description: candidate.description,
        image: candidate.imageContentType
          ? '/api/images/' + election._id + '/' + candidate._id
          : candidate.image
      };
    })
  };
}

function activeElectionQuery() {
  var now = new Date();
  return {
    status: 'open',
    startsAt: { $lte: now },
    endsAt: { $gte: now }
  };
}

router.get('/encuestas', async function(req, res, next) {
  if (!requireDatabase(res)) {
    return;
  }
  try {
    var elections = await Election.find(activeElectionQuery())
      .select(
        'title description startsAt endsAt candidates._id candidates.name ' +
        'candidates.description candidates.image candidates.imageContentType'
      )
      .sort({ startsAt: 1 })
      .lean();
    return res.json({ elections: elections.map(publicElection) });
  } catch (error) {
    return next(error);
  }
});

router.get('/encuestas/:electionId', async function(req, res, next) {
  if (!requireDatabase(res)) {
    return;
  }
  if (!mongoose.isValidObjectId(req.params.electionId)) {
    return res.status(400).json({ error: 'El identificador de la encuesta no es válido.' });
  }
  try {
    var election = await Election.findOne({
      _id: req.params.electionId,
      ...activeElectionQuery()
    }).select(
      'title description startsAt endsAt candidates._id candidates.name ' +
      'candidates.description candidates.image candidates.imageContentType'
    );
    if (!election) {
      return res.status(404).json({ error: 'La encuesta no está activa o no existe.' });
    }
    return res.json({ election: publicElection(election) });
  } catch (error) {
    return next(error);
  }
});

router.post('/encuestas/:electionId/votos', requireApiKey, async function(req, res, next) {
  if (!requireDatabase(res)) {
    return;
  }
  if (!mongoose.isValidObjectId(req.params.electionId)) {
    return res.status(400).json({ error: 'El identificador de la encuesta no es válido.' });
  }
  var parsed = parseExternalVote(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }
  if (!mongoose.isValidObjectId(parsed.value.candidateId)) {
    return res.status(400).json({ error: 'El identificador de la candidatura no es válido.' });
  }

  try {
    var now = new Date();
    var election = await Election.findOne({
      _id: req.params.electionId,
      status: 'open',
      startsAt: { $lte: now },
      endsAt: { $gte: now },
      'candidates._id': parsed.value.candidateId
    }).select('_id candidates._id');
    if (!election) {
      return res.status(404).json({
        error: 'La encuesta no está activa o la candidatura no existe.'
      });
    }

    var voterData = parsed.value.voter;
    var voter = await Voter.findOne({ dni: voterData.dni });
    if (!voter) {
      try {
        voter = await Voter.create({
          dni: voterData.dni,
          fullName: voterData.fullName,
          sex: voterData.sex,
          age: voterData.age,
          email: voterData.email,
          educationLevel: voterData.educationLevel,
          isExternal: true
        });
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
        voter = await Voter.findOne({ dni: voterData.dni });
        if (!voter) {
          throw error;
        }
      }
    }

    var participation = await Voter.updateOne({
      _id: voter._id,
      electionsParticipated: { $ne: election._id }
    }, {
      $addToSet: { electionsParticipated: election._id }
    });
    if (!participation.modifiedCount) {
      return res.status(409).json({ error: 'Este votante ya participó en esta encuesta.' });
    }

    var voteResult;
    try {
      voteResult = await Election.updateOne({
        _id: election._id,
        status: 'open',
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() },
        'candidates._id': parsed.value.candidateId
      }, {
        $inc: { 'candidates.$.votes': 1 }
      });
    } catch (error) {
      await Voter.updateOne(
        { _id: voter._id },
        { $pull: { electionsParticipated: election._id } }
      );
      throw error;
    }

    if (!voteResult.modifiedCount) {
      await Voter.updateOne(
        { _id: voter._id },
        { $pull: { electionsParticipated: election._id } }
      );
      return res.status(409).json({ error: 'La encuesta se cerró y el voto no fue registrado.' });
    }

    return res.status(201).json({
      message: 'Voto registrado correctamente.',
      electionId: election._id,
      candidateId: parsed.value.candidateId
    });
  } catch (error) {
    return next(error);
  }
});

router.use(function(error, req, res, next) {
  console.error('Error en la API externa:', error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ error: 'No se pudo completar la solicitud.' });
});

module.exports = router;
