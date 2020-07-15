const express = require('express');
const router = express.Router();
const log4js = require('log4js');
const log = log4js.getLogger('index');
const { sendDataToDevice } = require('../config/mqttbroker.config');

/* GET home page. */
router.get('/', function(req, res, next) {
  try {
    const deviceId = req.query.device_id;
    const messageId = req.query.message_id;
    const { operator, content } = req.query.operator;

    log.info(`deviceId: ${deviceId}, message_id:${message_id}, operator: ${operator}, content: ${content}`);

    const result = sendDataToDevice(deviceId, messageId, content);

    res.send(result);
  } catch (e) {
    log.error(e);
    res.send(e);
  }
});

module.exports = router;
