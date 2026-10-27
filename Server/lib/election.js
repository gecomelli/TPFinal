function normalizeName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function normalizeDni(value) {
  return typeof value === 'string' ? value.trim().replace(/\D/g, '') : '';
}

function validateDni(dni) {
  return /^\d{7,8}$/.test(dni)
    ? ''
    : 'Ingresa un DNI valido de 7 u 8 numeros.';
}

function validateVoter(fullName, sex, age, email, education, dni) {
  if (fullName.length < 2 || fullName.length > 60) {
    return 'Ingresa un nombre de entre 2 y 60 caracteres.';
  }
  if (sex !== 'M' && sex !== 'F') {
    return 'Selecciona un sexo valido.';
  }
  if (age < 0 || age > 150) {
    return 'Ingresa una edad valida.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Ingresa un email valido.';
  }
  if (education.length < 2 || education.length > 60) {
    return 'Ingresa un nivel de educacion de entre 2 y 60 caracteres.';
  }
  return validateDni(dni);
}

module.exports = {
  normalizeDni: normalizeDni,
  normalizeName: normalizeName,
  validateDni: validateDni,
  validateVoter: validateVoter
};
