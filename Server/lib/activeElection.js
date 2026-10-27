function getActiveElectionId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value.trim())) {
    return null;
  }
  return value.trim();
}

module.exports = getActiveElectionId;
