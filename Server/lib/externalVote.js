var electionUtils = require('./election');

function parseExternalVote(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !body.voter || typeof body.voter !== 'object' || Array.isArray(body.voter)) {
    return { error: 'Envía los datos de la candidatura y del votante.' };
  }

  var voter = body.voter;
  if (typeof body.candidateId !== 'string' ||
      typeof voter.dni !== 'string' ||
      typeof voter.fullName !== 'string' ||
      typeof voter.sex !== 'string' ||
      typeof voter.age !== 'number' ||
      !Number.isInteger(voter.age) ||
      typeof voter.email !== 'string' ||
      typeof voter.educationLevel !== 'string') {
    return { error: 'Completa todos los datos del votante y una candidatura válida.' };
  }

  var normalizedVoter = {
    dni: electionUtils.normalizeDni(voter.dni),
    fullName: electionUtils.normalizeName(voter.fullName),
    sex: voter.sex,
    age: voter.age,
    email: voter.email.trim(),
    educationLevel: voter.educationLevel
  };
  var validationError = electionUtils.validateVoter(
    normalizedVoter.fullName,
    normalizedVoter.sex,
    normalizedVoter.age,
    normalizedVoter.email,
    normalizedVoter.educationLevel,
    normalizedVoter.dni
  );
  if (validationError) {
    return { error: validationError };
  }
  if (['Primario', 'Secundario', 'Terciario', 'Universitario'].indexOf(
    normalizedVoter.educationLevel
  ) === -1) {
    return { error: 'Selecciona un nivel educativo válido.' };
  }

  return {
    value: {
      candidateId: body.candidateId,
      voter: normalizedVoter
    }
  };
}

module.exports = parseExternalVote;
