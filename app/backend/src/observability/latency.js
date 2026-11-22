// src/observability/latency.js
const logger = require('./logger');

/**
 * Démarre un chronomètre haute résolution pour une étape donnée.
 * @param {string} stage Nom de l'étape ('asr', 'nlu', 'dialog', 'tts', 'total')
 * @returns {{ end: () => number }}
 */
function startTimer(stage = 'operation') {
  const start = process.hrtime.bigint();

  return {
    end: () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const rounded = Math.round(durationMs * 100) / 100;
      return rounded;
    }
  };
}

/**
 * Crée un traqueur de latences pour une requête complète.
 */
function createPipelineTracker(traceId) {
  const stages = {};
  const globalTimer = startTimer('pipeline_total');

  return {
    track: async (stageName, fn) => {
      const timer = startTimer(stageName);
      try {
        return await fn();
      } finally {
        stages[stageName] = timer.end();
      }
    },
    recordStage: (stageName, durationMs) => {
      stages[stageName] = Math.round(durationMs * 100) / 100;
    },
    getSummary: () => {
      const totalMs = globalTimer.end();
      const budgetExceeded = totalMs > 5000; // Budget cible ENF-01 <= 5.0s

      if (budgetExceeded) {
        logger.warn('SLA_BUDGET_EXCEEDED', {
          traceId,
          totalMs,
          stages,
          slaTargetMs: 5000
        });
      }

      return {
        stages,
        totalMs,
        budgetOk: !budgetExceeded
      };
    }
  };
}

module.exports = { startTimer, createPipelineTracker };