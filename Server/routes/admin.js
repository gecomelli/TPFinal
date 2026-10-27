var express = require('express');
var crypto = require('crypto');
var mongoose = require('mongoose');
var Election = require('../models/Election');
var candidateImage = require('../lib/candidateImage');

var router = express.Router();
var sessionCookie = 'admin_session';
var sessionDuration = 8 * 60 * 60 * 1000;
var maximumElectionImageBytes = 8 * 1024 * 1024;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function sessionSignature(timestamp, password) {
  return crypto.createHmac('sha256', password).update(timestamp).digest('hex');
}

function safeEqual(first, second) {
  var firstBuffer = Buffer.from(first);
  var secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length &&
    crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function isValidSession(value, password) {
  if (typeof value !== 'string') {
    return false;
  }
  var parts = value.split('.');
  if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^[a-f\d]{64}$/.test(parts[1])) {
    return false;
  }
  var issuedAt = Number(parts[0]);
  var now = Date.now();
  var issuedAtMs = issuedAt * 1000;
  return issuedAtMs <= now + 60000 &&
    issuedAtMs > now - sessionDuration &&
    safeEqual(parts[1], sessionSignature(parts[0], password));
}

function requireAdmin(req, res, next) {
  var password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return sendError(res, 503, 'Configura ADMIN_PASSWORD en el entorno del servidor.');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(req.method) !== -1) {
    var origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) {
          return sendError(res, 403, 'Solicitud de administracion no permitida.');
        }
      } catch (error) {
        return sendError(res, 403, 'Origen de solicitud invalido.');
      }
    }
  }
  if (!isValidSession(req.cookies && req.cookies[sessionCookie], password)) {
    return sendError(res, 401, 'Inicia sesion para administrar las encuestas.');
  }
  return next();
}

function parseElectionPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Completa los datos de la encuesta.' };
  }

  var title = typeof body.title === 'string' ? body.title.trim() : '';
  var description = typeof body.description === 'string' ? body.description.trim() : '';
  var startsAt = new Date(body.startsAt);
  var endsAt = new Date(body.endsAt);
  var allowedStatuses = ['scheduled', 'open', 'closed', 'finalized'];

  if (!title || title.length > 120) {
    return { error: 'El titulo es obligatorio y no puede superar 120 caracteres.' };
  }
  if (!description || description.length > 500) {
    return { error: 'La descripcion es obligatoria y no puede superar 500 caracteres.' };
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return { error: 'Ingresa fechas validas y asegúrate de que el cierre sea posterior al inicio.' };
  }
  if (allowedStatuses.indexOf(body.status) === -1) {
    return { error: 'Selecciona un estado valido para la encuesta.' };
  }
  if (!Array.isArray(body.candidates) || !body.candidates.length) {
    return { error: 'Agrega al menos una candidatura.' };
  }

  var candidates = [];
  var uploadedImageBytes = 0;
  for (var i = 0; i < body.candidates.length; i += 1) {
    var candidate = body.candidates[i];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { error: 'Los datos de las candidaturas no son validos.' };
    }
    var name = candidate && typeof candidate.name === 'string' ? candidate.name.trim() : '';
    var candidateDescription = candidate && typeof candidate.description === 'string'
      ? candidate.description.trim()
      : '';
    var image = candidate && typeof candidate.image === 'string'
      ? candidate.image.trim()
      : '/images/candidates/default.svg';
    var validImage = /^\/images\/candidates\/[a-zA-Z0-9._-]+$/.test(image) ||
      /^https:\/\/[^\s]+$/i.test(image);

    if (!name || name.length > 100) {
      return { error: 'Cada candidatura debe tener un nombre de hasta 100 caracteres.' };
    }
    if (candidateDescription.length > 300) {
      return { error: 'La descripcion de cada candidatura no puede superar 300 caracteres.' };
    }
    if (!validImage) {
      return { error: 'Usa una imagen local de candidaturas o una URL HTTPS.' };
    }
    var uploadedImage;
    if (candidate.imageUpload) {
      uploadedImage = candidateImage.decodeImageUpload(candidate.imageUpload);
      if (uploadedImage.error) {
        return uploadedImage;
      }
      uploadedImageBytes += uploadedImage.value.data.length;
      if (uploadedImageBytes > maximumElectionImageBytes) {
        return { error: 'El total de imagenes cargadas por encuesta no puede superar 8 MB.' };
      }
    }
    if (candidate._id && !mongoose.isValidObjectId(candidate._id)) {
      return { error: 'Una candidatura contiene un identificador invalido.' };
    }
    candidates.push({
      _id: candidate._id,
      name: name,
      description: candidateDescription,
      image: image,
      imageData: uploadedImage && uploadedImage.value.data,
      imageContentType: uploadedImage && uploadedImage.value.contentType
    });
  }

  return {
    value: {
      title: title,
      description: description,
      startsAt: startsAt,
      endsAt: endsAt,
      status: body.status,
      candidates: candidates
    }
  };
}

function serializeElection(election) {
  var value = election.toObject ? election.toObject() : election;
  value.candidates = value.candidates.map(function(candidate) {
    var serialized = Object.assign({}, candidate);
    delete serialized.imageData;
    serialized.imageUrl = candidate.imageContentType
      ? '/api/images/' + value._id + '/' + candidate._id
      : candidate.image;
    return serialized;
  });
  return value;
}

router.post('/login', function(req, res) {
  var password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return sendError(res, 503, 'Configura ADMIN_PASSWORD en el entorno del servidor.');
  }
  var submittedPassword = typeof req.body.password === 'string' ? req.body.password : '';
  if (!safeEqual(submittedPassword, password)) {
    return sendError(res, 401, 'La clave ingresada no es correcta.');
  }

  var timestamp = String(Math.floor(Date.now() / 1000));
  var value = timestamp + '.' + sessionSignature(timestamp, password);
  return res.cookie(sessionCookie, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: sessionDuration
  }).json({ authenticated: true });
});

router.post('/logout', function(req, res) {
  return res.clearCookie(sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin'
  }).json({ authenticated: false });
});

router.get('/session', requireAdmin, function(req, res) {
  return res.json({ authenticated: true });
});

router.use(requireAdmin);

router.get('/elections', async function(req, res, next) {
  try {
    var elections = await Election.find({})
      .select('-candidates.imageData')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ elections: elections.map(serializeElection) });
  } catch (error) {
    return next(error);
  }
});

router.post('/elections', async function(req, res, next) {
  var parsed = parseElectionPayload(req.body);
  if (parsed.error) {
    return sendError(res, 400, parsed.error);
  }
  try {
    var election = await Election.create(parsed.value);
    return res.status(201).json({ election: serializeElection(election) });
  } catch (error) {
    return next(error);
  }
});

router.put('/elections/:electionId', async function(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.electionId)) {
    return sendError(res, 400, 'El identificador de la encuesta no es valido.');
  }
  var parsed = parseElectionPayload(req.body);
  if (parsed.error) {
    return sendError(res, 400, parsed.error);
  }
  try {
    var election = await Election.findById(req.params.electionId);
    if (!election) {
      return sendError(res, 404, 'No se encontro la encuesta solicitada.');
    }

    var existingCandidates = new Map(election.candidates.map(function(candidate) {
      return [candidate._id.toString(), candidate];
    }));
    var submittedCandidateIds = new Set(parsed.value.candidates.map(function(candidate) {
      return candidate._id && candidate._id.toString();
    }).filter(Boolean));
    var removingVotes = election.candidates.some(function(candidate) {
      return candidate.votes > 0 && !submittedCandidateIds.has(candidate._id.toString());
    });
    if (removingVotes) {
      return sendError(res, 409, 'No puedes quitar una candidatura que ya tiene votos registrados.');
    }
    election.title = parsed.value.title;
    election.description = parsed.value.description;
    election.startsAt = parsed.value.startsAt;
    election.endsAt = parsed.value.endsAt;
    election.status = parsed.value.status;
    var candidates = parsed.value.candidates.map(function(candidate) {
      var existing = candidate._id ? existingCandidates.get(candidate._id.toString()) : null;
      var keepExistingImage = existing && !candidate.imageData && candidate.image === existing.image;
      return {
        _id: existing ? existing._id : undefined,
        name: candidate.name,
        description: candidate.description,
        image: candidate.image,
        imageData: candidate.imageData || (keepExistingImage ? existing.imageData : undefined),
        imageContentType: candidate.imageContentType ||
          (keepExistingImage ? existing.imageContentType : undefined),
        votes: existing ? existing.votes : 0
      };
    });
    var totalImageBytes = candidates.reduce(function(total, candidate) {
      return total + (candidate.imageData ? candidate.imageData.length : 0);
    }, 0);
    if (totalImageBytes > maximumElectionImageBytes) {
      return sendError(res, 400, 'El total de imagenes guardadas por encuesta no puede superar 8 MB.');
    }
    election.candidates = candidates;
    await election.save();
    return res.json({ election: serializeElection(election) });
  } catch (error) {
    return next(error);
  }
});

router.delete('/elections/:electionId', async function(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.electionId)) {
    return sendError(res, 400, 'El identificador de la encuesta no es valido.');
  }
  try {
    var election = await Election.findById(req.params.electionId)
      .select('-candidates.imageData');
    if (!election) {
      return sendError(res, 404, 'No se encontro la encuesta solicitada.');
    }
    await Election.deleteOne({ _id: election._id });
    return res.json({ deleted: true });
  } catch (error) {
    return next(error);
  }
});

router.use(function(error, req, res, next) {
  console.error('Error en la API de administracion:', error);
  if (res.headersSent) {
    return next(error);
  }
  if (error.name === 'ValidationError') {
    return sendError(res, 400, 'Revisa los datos ingresados antes de guardar.');
  }
  return sendError(res, 500, 'No se pudo completar la operacion. Intentalo nuevamente.');
});

module.exports = router;
