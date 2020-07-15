const express = require('express');
const router = express.Router();
const log4js = require('log4js');
const log = log4js.getLogger('index');
const { sendDataToDevice } = require('../config/mqttbroker.config');

/* GET home page. */
router.get('/', async function(req, res, next) {
  try {
    const deviceId = req.query.device_id;
    const messageId = req.query.message_id;
    const { operator, content } = req.query;

    log.info(`deviceId: ${deviceId}, message_id:${messageId}, operator: ${operator}, content: ${content}`);

    const result = await sendDataToDevice(deviceId, messageId, content);
    res.send(result);
  } catch (e) {
    log.error(e);
    res.send(e);
  }
});

module.exports = router;
