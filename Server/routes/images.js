var express = require('express');
var mongoose = require('mongoose');
var Election = require('../models/Election');

var router = express.Router();

router.get('/:electionId/:candidateId', async function(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.electionId) ||
      !mongoose.isValidObjectId(req.params.candidateId)) {
    return res.status(400).end();
  }

  try {
    var election = await Election.findById(req.params.electionId)
      .select('candidates._id candidates.imageData candidates.imageContentType');
    if (!election) {
      return res.status(404).end();
    }
    var candidate = election.candidates.id(req.params.candidateId);
    if (!candidate || !candidate.imageData || !candidate.imageContentType) {
      return res.status(404).end();
    }

    res.set('Content-Type', candidate.imageContentType);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    return res.send(candidate.imageData);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
