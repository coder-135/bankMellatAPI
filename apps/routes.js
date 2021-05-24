const express = require('express');
const router = express.Router();
const controller = require('./controller/controller');

router.get('/mellat', controller.payment);
router.get('callbackmellat', controller.callBackMellat);

module.exports = router;