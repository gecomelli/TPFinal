var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Election = require('../models/Election');
var Voter = require('../models/Voter');
var electionUtils = require('../lib/election');
var getActiveElectionId = require('../lib/activeElection');

function databaseUnavailable(res) {
  return res.status(503).render('error', {
    title: 'Servicio no disponible',
    message: 'No se pudo conectar con las bases de datos. Intentalo nuevamente en unos minutos.',
    error: {}
  });
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function isElectionOpen(election) {
  var now = new Date();
  return election &&
    election.status === 'open' &&
    election.startsAt <= now &&
    election.endsAt >= now;
}

async function findElection(electionId) {
  if (!getActiveElectionId(electionId)) {
    return null;
  }
  var election = await Election.findById(electionId).select('-candidates.imageData');
  return isElectionOpen(election) ? election : null;
}

function electionUnavailable(res) {
  return res.status(404).render('error', {
    title: 'Eleccion no disponible',
    message: 'La eleccion solicitada no existe, aun no comenzo o ya finalizo.',
    error: { status: 404 }
  });
}

function voterParticipated(voter, electionId) {
  return voter.electionsParticipated.some(function(participatedElectionId) {
    return participatedElectionId.toString() === electionId.toString();
  });
}

function renderVoter(res, election, values, status) {
  return res.status(status || 200).render('voter', Object.assign({
    title: 'Datos del votante',
    activePage: 'vote',
    election: election,
    electionId: election._id,
    fullName: '',
    sex: '',
    age: '',
    email: '',
    education: '',
    dni: '',
    errorMessage: ''
  }, values));
}

async function renderElectionList(res, title, activePage, mode) {
  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }

  var now = new Date();
  var elections = mode === 'vote'
    ? await Election.find({
      status: 'open',
      startsAt: { $lte: now },
      endsAt: { $gte: now }
    }).select('-candidates.imageData').sort({ createdAt: -1 }).lean()
    : await Election.find({
      $or: [
        {
          status: 'open',
          startsAt: { $lte: now },
          endsAt: { $gte: now }
        },
        { status: 'finalized' }
      ]
    }).select('-candidates.imageData').sort({ createdAt: -1 }).lean();

  return res.render('election-list', {
    title: title,
    activePage: activePage,
    elections: elections,
    mode: mode,
    emptyMessage: mode === 'vote'
      ? 'No hay elecciones abiertas en este momento.'
      : 'No hay encuestas activas o finalizadas para consultar.'
  });
}

router.get('/', async function(req, res, next) {
  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }

  try {
    var now = new Date();
    var elections = await Election.find({
      status: 'open',
      startsAt: { $lte: now },
      endsAt: { $gte: now }
    }).select('-candidates.imageData').sort({ createdAt: -1 }).lean();

    return res.render('index', {
      title: 'Elecciones',
      activePage: 'home',
      elections: elections
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/admin', function(req, res) {
  return res.render('admin', {
    layout: false,
    title: 'Administrar encuestas'
  });
});

router.get('/votar', async function(req, res, next) {
  try {
    return await renderElectionList(res, 'Elecciones disponibles', 'vote', 'vote');
  } catch (error) {
    return next(error);
  }
});

router.get('/votaciones/:electionId/votar', async function(req, res, next) {
  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }
  try {
    var election = await findElection(req.params.electionId);
    if (!election) {
      return electionUnavailable(res);
    }
    return renderVoter(res, election, {});
  } catch (error) {
    return next(error);
  }
});

router.post('/votaciones/:electionId/identificacion', async function(req, res, next) {
  var dni = electionUtils.normalizeDni(req.body.dni);

  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }
  try {
    var election = await findElection(req.params.electionId);
    if (!election) {
      return electionUnavailable(res);
    }

    var voterError = electionUtils.validateDni(dni);
    if (voterError) {
      return renderVoter(res, election, {
        dni: dni,
        errorMessage: voterError
      }, 400);
    }

    var voter = await Voter.findOne({ dni: dni })
      .select('fullName sex age email educationLevel electionsParticipated')
      .lean();
    var alreadyVoted = voter && voterParticipated(voter, election._id);
    return renderVoter(res, election, {
      dni: dni,
      fullName: voter ? voter.fullName : '',
      sex: voter ? voter.sex : '',
      age: voter ? voter.age : '',
      email: voter ? voter.email : '',
      education: voter ? voter.educationLevel : '',
      voterRegistered: Boolean(voter),
      alreadyVoted: Boolean(alreadyVoted),
      lookupComplete: true,
      errorMessage: alreadyVoted
        ? 'Este DNI ya participo en esta eleccion.'
        : ''
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/votaciones/:electionId/seleccion', async function(req, res, next) {
  var dni = electionUtils.normalizeDni(req.body.dni);
  var fullName = electionUtils.normalizeName(req.body.fullName);
  var sex = req.body.sex;
  var age = req.body.age;
  var email = req.body.email;
  var education = req.body.education;

  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }
  try {
    var election = await findElection(req.params.electionId);
    if (!election) {
      return electionUnavailable(res);
    }

    var voterError = electionUtils.validateVoter(fullName, sex, age, email, education, dni);
    if (voterError) {
      return renderVoter(res, election, {
        dni: dni,
        fullName: fullName,
        sex: sex,
        age: age,
        email: email,
        education: education,
        lookupComplete: true,
        errorMessage: voterError
      }, 400);
    }

    var voter = await Voter.findOne({ dni: dni });
    if (!voter) {
      try {
        voter = await Voter.findOneAndUpdate(
          { dni: dni },
          { $setOnInsert: { dni: dni, fullName: fullName, sex: sex, age: age, email: email, educationLevel: education } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
        voter = await Voter.findOne({ dni: dni });
        if (!voter) {
          throw error;
        }
      }
    }

    if (voterParticipated(voter, election._id)) {
      return renderVoter(res, election, {
        dni: dni,
        fullName: voter.fullName,
        voterRegistered: true,
        lookupComplete: true,
        alreadyVoted: true,
        errorMessage: 'Este DNI ya participo en esta eleccion.'
      }, 409);
    }

    var candidates = election.candidates.slice();
    if (!candidates.length) {
      return res.status(409).render('error', {
        title: 'Eleccion no disponible',
        message: 'Esta eleccion todavia no tiene candidatos cargados.',
        error: { status: 409 }
      });
    }

    return res.render('candidate', {
      title: 'Seleccion de candidato',
      activePage: 'vote',
      election: election,
      electionId: election._id,
      fullName: voter.fullName,
      sex: voter.sex,
      age: voter.age,
      email: voter.email,
      education: voter.educationLevel,
      dni: dni,
      candidates: candidates,
      errorMessage: ''
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/votaciones/:electionId/votar', async function(req, res, next) {
  var dni = electionUtils.normalizeDni(req.body.dni);
  var candidateId = req.body.candidate;

  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }
  var election;
  var candidates = [];
  try {
    election = await findElection(req.params.electionId);
    if (!election) {
      return electionUnavailable(res);
    }

    candidates = election.candidates.slice();
    var selectedCandidate = election.candidates.find(function(candidate) {
      return candidate._id.toString() === candidateId;
    });
    var voter = await Voter.findOne({ dni: dni });

    if (!/^\d{7,8}$/.test(dni) || !selectedCandidate || !voter) {
      return res.status(400).render('candidate', {
        title: 'Seleccion de candidato',
        activePage: 'vote',
        election: election,
        electionId: election._id,
        fullName: voter ? voter.fullName : '',
        sex: voter ? voter.sex : '',
        age: voter ? voter.age : '',
        email: voter ? voter.email : '',
        education: voter ? voter.educationLevel : '',
        dni: dni,
        candidates: candidates,
        errorMessage: 'Verifica tus datos y selecciona un candidato valido.'
      });
    }

    var participation = await Voter.updateOne(
      { _id: voter._id, electionsParticipated: { $ne: election._id } },
      { $addToSet: { electionsParticipated: election._id } }
    );
    if (!participation.modifiedCount) {
      return res.status(409).render('candidate', {
        title: 'Seleccion de candidato',
        activePage: 'vote',
        election: election,
        electionId: election._id,
        fullName: voter.fullName,
        sex: voter.sex,
        age: voter.age,
        email: voter.email,
        education: voter.educationLevel,
        dni: dni,
        candidates: candidates,
        errorMessage: 'Este DNI ya participo en esta eleccion.'
      });
    }

    var voteResult;
    try {
      voteResult = await Election.updateOne({
        _id: election._id,
        status: 'open',
        startsAt: { $lte: new Date() },
        endsAt: { $gte: new Date() },
        'candidates._id': selectedCandidate._id
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
      return res.status(409).render('candidate', {
        title: 'Seleccion de candidato',
        activePage: 'vote',
        election: election,
        electionId: election._id,
        fullName: voter.fullName,
        sex: voter.sex,
        age: voter.age,
        email: voter.email,
        education: voter.educationLevel,
        dni: dni,
        candidates: candidates,
        errorMessage: 'La eleccion ya no esta abierta. No se registro tu voto.'
      });
    }

    return res.redirect('/estadisticas/' + election._id);
  } catch (error) {
    return next(error);
  }
});

router.get('/votar/confirmacion', function(req, res) {
  return res.render('vote-confirmation', {
    title: 'Voto registrado',
    activePage: 'vote'
  });
});

router.get('/estadisticas', async function(req, res, next) {
  try {
    return await renderElectionList(res, 'Estadisticas', 'statistics', 'statistics');
  } catch (error) {
    return next(error);
  }
});

router.get('/estadisticas/:electionId', async function(req, res, next) {
  if (!isDatabaseConnected()) {
    return databaseUnavailable(res);
  }
  res.set('Cache-Control', 'no-store');
  try {
    var electionId = getActiveElectionId(req.params.electionId);
    if (!electionId) {
      return res.status(404).render('error', {
        title: 'Eleccion no encontrada',
        message: 'La eleccion solicitada no existe.',
        error: { status: 404 }
      });
    }

    var election = await Election.findById(electionId)
      .select('-candidates.imageData')
      .lean();
    if (!election ||
      !(isElectionOpen(election) || election.status === 'finalized')) {
      return res.status(404).render('error', {
        title: 'Eleccion no encontrada',
        message: 'La encuesta no existe, no esta activa o no ha finalizado.',
        error: { status: 404 }
      });
    }

    var candidates = election.candidates.slice().sort(function(first, second) {
      return second.votes - first.votes;
    });
    var totalVotes = candidates.reduce(function(total, candidate) {
      return total + candidate.votes;
    }, 0);

    return res.render('statistics', {
      title: 'Estadisticas',
      activePage: 'statistics',
      election: election,
      candidates: candidates.map(function(candidate) {
        var percentage = totalVotes
          ? candidate.votes / totalVotes * 100
          : 0;
        return Object.assign({}, candidate, {
          percentage: percentage,
          percentageLabel: percentage.toFixed(1)
        });
      }),
      totalVotes: totalVotes
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
