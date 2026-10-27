require('dotenv').config();

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var adminRouter = require('./routes/admin');
var imagesRouter = require('./routes/images');
var apiRouter = require('./routes/api');

var app = express();
const mongoose = require('mongoose');
const hbs = require('hbs');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

hbs.registerHelper('eq', function(arg1, arg2) {
  return arg1 === arg2;
});
hbs.registerHelper('candidateImage', function(candidate, electionId) {
  if (candidate && candidate.imageContentType && candidate._id && electionId) {
    return '/api/images/' + electionId + '/' + candidate._id;
  }
  return candidate && candidate.image;
});

app.use(logger('dev'));
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/cliente', express.static(path.join(__dirname, '..', 'Cliente')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/images', imagesRouter);
app.use('/api/v1', cors({
  origin: function(origin, callback) {
    var allowedOrigins = (process.env.API_CORS_ORIGINS || '')
      .split(',')
      .map(function(value) { return value.trim(); })
      .filter(Boolean);
    callback(null, !origin || allowedOrigins.indexOf(origin) !== -1);
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  maxAge: 600
}), apiRouter);

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';
mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB connectado correctamente a la base de datos encuestasDB en', mongoURI))
  .catch(err => console.error('MongoDB connection error:', err));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  if (req.path.indexOf('/api/v1/') === 0) {
    var status = err.status || 500;
    var message = status === 413
      ? 'El cuerpo de la solicitud supera el tamaño permitido.'
      : status === 400
        ? 'El JSON de la solicitud no es válido.'
        : 'No se pudo completar la solicitud.';
    return res.status(status).json({ error: message });
  }
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
