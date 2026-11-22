// src/i18n/t.js
const fs = require('fs');
const path = require('path');

// Chargement synchrone des catalogues au démarrage
const catalogs = {
  fr: require('./catalog.fr.json'),
  fon: require('./catalog.fon.json'),
  yor: require('./catalog.yor.json')
};

const DEFAULT_LANG = 'fr';

/**
 * Formate un nombre pour l'affichage (ex: 42500 -> "42 500").
 * @param {number|string} val
 * @returns {string}
 */
function formatNumber(val) {
  if (typeof val === 'number') {
    return val.toLocaleString('fr-FR');
  }
  return val;
}

/**
 * Traduit une clé avec interpolation de variables.
 * @param {string} lang 'fon' | 'yor' | 'fr'
 * @param {string} key Clé du catalogue
 * @param {object} params Variables à injecter (ex: { amount: 5000, recipient: 'Koffi' })
 * @returns {string} Message traduit et interpolé
 */
function t(lang = 'fon', key, params = {}) {
  const selectedLang = catalogs[lang] ? lang : DEFAULT_LANG;
  const catalog = catalogs[selectedLang];

  // 1. Récupération du template ou fallback vers 'fr'
  let template = catalog[key] || catalogs[DEFAULT_LANG][key];

  if (!template) {
    return `[MISSING_TRANSLATION:${selectedLang}:${key}]`;
  }

  // 2. Remplacement dynamique des variables {paramName}
  for (const [paramKey, paramValue] of Object.entries(params)) {
    const formattedVal = (paramKey === 'amount' || paramKey === 'balance' || paramKey === 'fee' || paramKey === 'total' || paramKey === 'spent' || paramKey === 'limit' || paramKey === 'remaining' || paramKey === 'newBalance')
      ? formatNumber(paramValue)
      : paramValue;

    template = template.replaceAll(`{${paramKey}}`, formattedVal);
  }

  return template;
}

/**
 * Vérifie la parité exacte des clés entre le catalogue FR et les autres langues.
 * Utile pour les tests automatisés.
 */
function verifyCatalogParity() {
  const frKeys = Object.keys(catalogs.fr).sort();
  const errors = [];

  for (const lang of ['fon', 'yor']) {
    const langKeys = Object.keys(catalogs[lang]);
    const missing = frKeys.filter(k => !langKeys.includes(k));
    const extra = langKeys.filter(k => !frKeys.includes(k));

    if (missing.length > 0) {
      errors.push(`[${lang}] Clés manquantes par rapport au français : ${missing.join(', ')}`);
    }
    if (extra.length > 0) {
      errors.push(`[${lang}] Clés en trop par rapport au français : ${extra.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    totalKeys: frKeys.length,
    errors
  };
}

module.exports = { t, formatNumber, verifyCatalogParity, catalogs };