var test = require('node:test');
var assert = require('node:assert/strict');
var election = require('../lib/election');
var getActiveElectionId = require('../lib/activeElection');
var parseCsv = require('../lib/parseCsv');

test('normalizes voter input before validation', function() {
  assert.equal(election.normalizeName('  Ana   Perez  '), 'Ana Perez');
  assert.equal(election.normalizeDni('12.345.678'), '12345678');
  assert.equal(
    election.validateVoter('Ana Perez', 'M', 30, 'ana@example.com', 'Secundario', '12345678'),
    ''
  );
});

test('rejects invalid voter data', function() {
  assert.match(election.validateVoter('', 'M', 30, 'ana@example.com', 'Secundario', '12345678'), /nombre/i);
  assert.match(election.validateVoter('Ana Perez', '', 30, 'ana@example.com', 'Secundario', '12345678'), /sexo/i);
  assert.match(election.validateDni('1234'), /DNI/i);
});

test('accepts registered voter data with the stored sex values', function() {
  ['M', 'F'].forEach(function(sex) {
    assert.equal(
      election.validateVoter('Ana Perez', sex, 30, 'ana@example.com', 'Secundario', '12345678'),
      ''
    );
  });
});

test('accepts only a MongoDB ObjectId as the configured active election', function() {
  assert.equal(getActiveElectionId('507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
  assert.equal(getActiveElectionId('invalid-id'), null);
  assert.equal(getActiveElectionId(undefined), null);
});

test('parses quoted CSV values, line breaks and semicolon delimiters', function() {
  assert.deepEqual(parseCsv('DNI,Nombre\r\n12345678,"Ana, Maria"\r\n87654321,"Juan\nPerez"'), [
    ['DNI', 'Nombre'],
    ['12345678', 'Ana, Maria'],
    ['87654321', 'Juan\nPerez']
  ]);
  assert.deepEqual(parseCsv('DNI;Nombre\n12345678;Ana Perez', ';'), [
    ['DNI', 'Nombre'],
    ['12345678', 'Ana Perez']
  ]);
});
