// src/api/routes/demo.routes.js
const express = require('express');
const router = express.Router();
const demoCtrl = require('../controllers/demo.controller');

// Réinitialisation usine de la base pour la démo
router.post('/reset', demoCtrl.reset);

// Déclencheur de scénario 1-clic
router.post('/scenario', demoCtrl.runScenario);

// Crash-test d'idempotence (simulation bug réseau / double envoi)
router.post('/idempotency-test', demoCtrl.testIdempotency);

// Inspection complète de l'état (Audit, Session, Portefeuille)
router.get('/inspect', demoCtrl.inspect);

module.exports = router;