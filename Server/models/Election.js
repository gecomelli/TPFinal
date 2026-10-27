var mongoose = require('mongoose');
var electionConnection = mongoose.connection.useDb('encuestasDB', { useCache: true });

var candidateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
  },
  image: {
    type: String,
    required: true,
    trim: true,
    default: '/images/candidates/default.svg'
  },
  imageData: Buffer,
  imageContentType: {
    type: String,
    enum: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  votes: {
    type: Number,
    min: 0,
    default: 0
  }
});

var electionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  candidates: {
    type: [candidateSchema],
    default: []
  },
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return !this.startsAt || value > this.startsAt;
      },
      message: 'La fecha de finalizacion debe ser posterior a la fecha de inicio.'
    }
  },
  status: {
    type: String,
    enum: ['scheduled', 'open', 'closed', 'finalized'],
    default: 'scheduled',
    required: true
  }
}, {
  timestamps: true
});

module.exports = electionConnection.models.Election ||
  electionConnection.model('Election', electionSchema, 'encuestas');
