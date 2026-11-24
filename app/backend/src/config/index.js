const path = require("path");

module.exports = {
  port: process.env.PORT || 3030,
  env: process.env.NODE_ENV || "development",
  demoMode: process.env.DEMO_MODE !== "false",

  // Database
  dbPath: process.env.DB_PATH || path.join(__dirname, "../../data.sqlite"),

  // Seuils de confiance NLU/ASR (CdC §5.6 & O3)
  confidence: {
    high: 0.8, // Validation directe
    low: 0.5, // Reformulation
  },

  // Contraintes Financières & Sécurité (CdC ENF-14, ENF-15)
  transfer: {
    ttlMs: 30_000, // Expiration confirmation (30s)
    minAmount: 100,
    maxAmount: 500_000, // Plafond démo
    pinCeiling: 50_000, // Code PIN fictif au-delà (ENF-14)
    highAmountThreshold: 200_000,
  },

  // Timeouts par service Python ML (CdC ENF-11)
  timeouts: {
    asrMs: 6_000,
    nluMs: 1_000,
    ttsMs: 4_000,
  },

  // Anti-arnaque (CdC §5.7)
  antifraud: {
    unusualMultiplier: 3, // > 3x la médiane
    demoCap: 200_000, // Montant élevé alerte
  },

  // Limiteur de débit (CdC ENF-15)
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 req/min/session
  },

  // Services Python ML URLs
  mlServices: {
    asrUrl: process.env.ASR_SERVICE_URL || "http://localhost:5001",
    nluUrl: process.env.NLU_SERVICE_URL || "http://localhost:5002",
    ttsUrl: process.env.TTS_SERVICE_URL || "http://localhost:5003",
  },
};
