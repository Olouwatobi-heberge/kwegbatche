// Charge .env s'il existe (Node >= 20.12), sans dépendance
try { process.loadEnvFile(require('path').join(__dirname, '.env')); } catch (_) {}

const app = require('./app');
const config = require('./src/config');
const logger = require('./src/observability/logger');
const seed = require('./src/db/seed');

// Initialisation de la BDD avec les données démo
try {
  seed();
} catch (err) {
  logger.error('Erreur lors de l initialisation de la BDD', { error: err.message });
}

const server = app.listen(config.port, () => {
  logger.info(`🚀 Serveur backend KwèGbaTché démarré sur http://127.0.0.1:${config.port}`);
  logger.info(`Mode: ${config.env} | Mode Démo: ${config.demoMode}`);
});

// Gestion propre de la fermeture (Graceful Shutdown)
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  logger.info('Arrêt du serveur backend...');
  server.close(() => {
    logger.info('Serveur arrêté avec succès.');
    process.exit(0);
  });
}