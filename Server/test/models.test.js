var test = require('node:test');
var assert = require('node:assert/strict');
var Election = require('../models/Election');
var Voter = require('../models/Voter');

test('stores surveys and their embedded candidates in encuestasDB', function() {
  assert.equal(Election.collection.collectionName, 'encuestas');
  assert.equal(Election.db.name, 'encuestasDB');
  assert.equal(Election.schema.path('candidates').schema.path('votes').options.default, 0);
});

test('candidate documents provide a default image path', function() {
  var election = new Election({
    title: 'Eleccion de prueba',
    description: 'Descripcion de prueba',
    startsAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-02T10:00:00Z'),
    candidates: [{ name: 'Candidata' }]
  });
  assert.equal(election.candidates[0].image, '/images/candidates/default.svg');
});

test('candidate documents can store an uploaded image as binary data', function() {
  var election = new Election({
    title: 'Encuesta de prueba',
    description: 'Descripcion de prueba',
    startsAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-02T10:00:00Z'),
    candidates: [{
      name: 'Candidata',
      imageData: Buffer.from([137, 80, 78, 71]),
      imageContentType: 'image/png'
    }]
  });
  assert.equal(Election.schema.path('candidates').schema.path('imageData').instance, 'Buffer');
  assert.deepEqual(
    Buffer.from(election.candidates[0].imageData),
    Buffer.from([137, 80, 78, 71])
  );
  assert.equal(election.candidates[0].imageContentType, 'image/png');
});

test('elections accept the finalized status', async function() {
  assert.deepEqual(Election.schema.path('status').enumValues, [
    'scheduled',
    'open',
    'closed',
    'finalized'
  ]);
  var election = new Election({
    title: 'Eleccion finalizada',
    description: 'Descripcion de prueba',
    startsAt: new Date('2026-01-01T10:00:00Z'),
    endsAt: new Date('2026-01-02T10:00:00Z'),
    status: 'finalized',
    candidates: [{ name: 'Candidata' }]
  });
  await assert.doesNotReject(election.validate());
});

test('elections require start and end dates and reject inverted date ranges', async function() {
  var election = new Election({
    title: 'Eleccion de prueba',
    description: 'Descripcion de prueba',
    startsAt: new Date('2026-01-02T10:00:00Z'),
    endsAt: new Date('2026-01-01T10:00:00Z')
  });
  await assert.rejects(election.validate(), function(error) {
    return Boolean(error.errors.endsAt);
  });
});

test('stores voter details and participation in the shared encuestasDB', function() {
  var voter = new Voter();
  assert.equal(Voter.collection.collectionName, 'usuarios');
  assert.equal(Voter.db.name, 'encuestasDB');
  assert.equal(Voter.db, Election.db);
  assert.equal(voter.schema.path('dni').options.unique, true);
  assert.equal(voter.schema.path('fullName').options.required, true);
  assert.equal(voter.schema.path('isExternal').options.default, false);
  assert.equal(voter.isExternal, false);
  assert.deepEqual(voter.electionsParticipated, []);
  assert.ok(voter.createdAt instanceof Date);
});
