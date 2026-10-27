var test = require('node:test');
var assert = require('node:assert/strict');
var parseExternalVote = require('../lib/externalVote');

function validPayload() {
  return {
    candidateId: '507f1f77bcf86cd799439011',
    voter: {
      dni: '12.345.678',
      fullName: '  Ana   Perez ',
      sex: 'F',
      age: 30,
      email: 'ana@example.com',
      educationLevel: 'Secundario'
    }
  };
}

test('validates and normalizes the complete external voting payload', function() {
  var result = parseExternalVote(validPayload());
  assert.equal(result.value.voter.dni, '12345678');
  assert.equal(result.value.voter.fullName, 'Ana Perez');
  assert.equal(result.value.voter.educationLevel, 'Secundario');
});

test('requires all voter fields and an allowed education level', function() {
  var payload = validPayload();
  delete payload.voter.email;
  assert.match(parseExternalVote(payload).error, /todos los datos/i);

  payload = validPayload();
  payload.voter.educationLevel = 'Otro';
  assert.match(parseExternalVote(payload).error, /nivel educativo/i);
});

test('requires a whole-number age and valid voter details', function() {
  var payload = validPayload();
  payload.voter.age = 30.5;
  assert.match(parseExternalVote(payload).error, /todos los datos/i);

  payload = validPayload();
  payload.voter.age = 151;
  assert.match(parseExternalVote(payload).error, /edad/i);
});
