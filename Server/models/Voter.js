var mongoose = require('mongoose');
var usersConnection = mongoose.connection.useDb('encuestasDB', { useCache: true });

var voterSchema = new mongoose.Schema({
  dni: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: /^\d{7,8}$/
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  sex: {
    type: String,
    enum: ['M', 'F'],
    required: true
  },
  educationLevel: {
    type: String,
    enum: ['Primario', 'Secundario', 'Terciario', 'Universitario'],
    required: true
  },
  age: {
    type: Number,
    required: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  isExternal: {
    type: Boolean,
    default: false
  },
  electionsParticipated: {
    type: [mongoose.Schema.Types.ObjectId],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = usersConnection.models.Voter ||
  usersConnection.model('Voter', voterSchema, 'usuarios');
