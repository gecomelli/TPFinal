var test = require('node:test');
var assert = require('node:assert/strict');
var candidateImage = require('../lib/candidateImage');

test('decodes valid PNG image uploads', function() {
  var data = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var result = candidateImage.decodeImageUpload({
    contentType: 'image/png',
    data: data.toString('base64')
  });
  assert.deepEqual(result.value.data, data);
  assert.equal(result.value.contentType, 'image/png');
});

test('rejects unsupported image types and invalid signatures', function() {
  assert.match(candidateImage.decodeImageUpload({
    contentType: 'text/plain',
    data: Buffer.from('hello').toString('base64')
  }).error, /JPEG, PNG, GIF o WebP/);
  assert.match(candidateImage.decodeImageUpload({
    contentType: 'image/png',
    data: Buffer.from('not an image').toString('base64')
  }).error, /imagen valida/);
});

test('rejects malformed base64 and image files over the size limit', function() {
  assert.match(candidateImage.decodeImageUpload({
    contentType: 'image/png',
    data: '%%%%'
  }).error, /imagen valida/);
  assert.match(candidateImage.decodeImageUpload({
    contentType: 'image/png',
    data: Buffer.alloc(candidateImage.maximumImageBytes + 1).toString('base64')
  }).error, /limite de 2 MB/);
});
