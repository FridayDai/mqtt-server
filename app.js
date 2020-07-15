const express = require('express');
// const path = require('path');
const cookieParser = require('cookie-parser');
const log4js = require('log4js');
const log4jsConfig = require('./config/log4js.config');

const indexRouter = require('./routes');
// const usersRouter = require('./routes/users');

log4js.configure(log4jsConfig);

const app = express();

// app.use(logger('dev'));
app.use(log4js.connectLogger(log4js.getLogger('http'), { level: 'auto' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
// app.use('/users', usersRouter);

module.exports = app;
