// src/api/routes/dialog.routes.js
const express = require('express');
const router = express.Router();
const dialogCtrl = require('../controllers/dialog.controller');

router.post('/turns', dialogCtrl.turn);
router.post('/confirm', dialogCtrl.confirm);
router.post('/cancel', dialogCtrl.cancel);

module.exports = router;