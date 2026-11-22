// src/api/routes/wallet.routes.js
const express = require("express");
const router = express.Router();
const walletCtrl = require("../controllers/wallet.controller");

router.get("/summary", walletCtrl.summary);
router.get("/contacts", walletCtrl.contacts);
router.get("/fees", walletCtrl.fees);
// router.get("/budget-week", walletCtrl.budgetWeek);

module.exports = router;
