const express = require('express');
const router = express.Router();
const path = require('path');
const log4js = require('log4js');
const query = require('../config/mysql.config');

const log = log4js.getLogger(path.basename(__filename));
/* GET users listing. */
router.get('/', async function(req, res, next) {
  log.info('app start...');
  log.error('this is an error');

  try {
    const results = await query('SELECT * from fa_admin');

    res.send({ 'data': results });
  } catch (e) {
    log.error(e);
    res.send(e);
  }

});

module.exports = router;
