const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("index", {
    title: "Accueil",
    traceId: req.traceId,
    version: "0.1.0",
  });
});

router.get("/health", (req, res) => {
  res.render("health", {
    title: "Santé",
    traceId: req.traceId,
    version: "0.1.0",
    services: { asr: "up", nlu: "up", tts: "up" },
  });
});

router.get("/demo", (req, res) => {
  res.render("demo", {
    title: "Démo API",
    traceId: req.traceId,
    version: "0.1.0",
  });
});

module.exports = router;
