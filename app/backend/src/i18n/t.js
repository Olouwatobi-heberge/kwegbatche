// src/i18n/t.js
const fs = require('fs');
const path = require('path');

function loadCatalog(lang) {
  const filePath = path.join(__dirname, `catalog.${lang}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Catalogue introuvable : ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const catalogs = {
  fr: loadCatalog('fr'),
  fon: loadCatalog('fon'),
  yor: loadCatalog('yor'),
};

/**
 * Table d'alias reliant les noms techniques aux clés de catalogue
 */
const KEY_ALIASES = {
  balance_recap: 'solde.reponse',
  balance_info: 'solde.reponse',
  budget_info: 'budget.resume',
  budget_recap: 'budget.resume',
  fees_info: 'frais.reponse',
  transfer_recap: 'transfert.recap',
  transfer_success: 'transfert.succes',
  transfer_cancelled: 'transfert.annule',
  out_of_scope: 'hors_sujet',
  insufficient_balance: 'erreurs.solde_insuffisant',
  error_insufficient_balance: 'erreurs.solde_insuffisant',
  unknown_recipient: 'erreurs.destinataire_inconnu',
  error_unknown_recipient: 'erreurs.destinataire_inconnu',
  invalid_amount: 'erreurs.montant_invalide',
  error_invalid_amount: 'erreurs.montant_invalide',

  // Alias de clarification et repli
  clarify_amount: 'erreurs.incompris',
  clarify_recipient: 'erreurs.incompris',
  clarify_contact: 'erreurs.incompris',
  fallback_rephrase: 'erreurs.incompris',
  clarification_needed: 'erreurs.incompris',

  // 🛡️ TOUTES LES CLÉS ANTI-FRAUDE (AR-01 à AR-05) :
  warning_unknown_contact: 'antifraude.contact_inconnu',
  antifraud_warning_unknown_contact: 'antifraude.contact_inconnu',

  warning_unusual_amount: 'antifraude.montant_inhabituel',
  antifraud_warning_unusual_amount: 'antifraude.montant_inhabituel',

  warning_urgency: 'antifraude.alerte_urgence',
  antifraud_warning_urgency: 'antifraude.alerte_urgence',

  warning_pin: 'antifraude.alerte_pin',
  antifraud_warning_pin: 'antifraude.alerte_pin',

  antifraud_blocked: 'antifraude.bloque'
};

/**
 * Recherche une clé dans un objet par dot-notation (ex: "solde.reponse")
 */
function getNestedValue(obj, dotKey) {
  if (!obj || typeof obj !== 'object' || !dotKey) return undefined;
  if (obj[dotKey] !== undefined) return obj[dotKey];

  const parts = dotKey.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Résolution universelle d'une clé (Directe -> Alias -> Dot-Notation)
 */
function resolveTemplate(catalog, key) {
  if (!catalog || typeof catalog !== 'object') return undefined;

  // 1. Clé directe à la racine
  if (catalog[key] !== undefined) return catalog[key];

  // 2. Via l'alias si défini
  const aliasTarget = KEY_ALIASES[key];
  if (aliasTarget) {
    const val = getNestedValue(catalog, aliasTarget);
    if (val !== undefined) return val;
  }

  // 3. Via dot-notation directe
  return getNestedValue(catalog, key);
}

/**
 * Traduit un texte avec interpolation robuste de toutes les variables {param}
 * Supporte : t(lang, key, params) ET t(key, lang, params)
 */
function t(arg1 = 'fr', arg2, arg3 = {}) {
  let lang = 'fr';
  let key = '';
  let params = {};

  const isLangCode = (v) => typeof v === 'string' && ['fon', 'fr', 'yor', 'yo'].includes(v.toLowerCase());

  // Détection de l'ordre des arguments
  if (isLangCode(arg1)) {
    lang = arg1.toLowerCase() === 'yo' ? 'yor' : arg1.toLowerCase();
    key = String(arg2 || '');
    params = typeof arg3 === 'object' && arg3 !== null ? arg3 : {};
  } else {
    key = String(arg1 || '');
    if (isLangCode(arg2)) {
      lang = arg2.toLowerCase() === 'yo' ? 'yor' : arg2.toLowerCase();
    }
    params = typeof arg3 === 'object' && arg3 !== null ? arg3 : (typeof arg2 === 'object' && arg2 !== null && !isLangCode(arg2) ? arg2 : {});
  }

  const catalog = catalogs[lang] || catalogs.fr;
  let template = resolveTemplate(catalog, key);

  // Fallback sur le catalogue français si clé manquante
  if (template === undefined && catalog !== catalogs.fr) {
    template = resolveTemplate(catalogs.fr, key);
  }

  // Si la clé est introuvable même en français
  if (template === undefined) {
    return `[MISSING_TRANSLATION:${lang}:${key}]`;
  }

  if (typeof template !== 'string') {
    return String(template);
  }

  // 1. Déduction ou génération d'une référence propre si demandée
  const fallbackRef = params.ref || 
                      params.reference || 
                      params.id || 
                      params.transaction_id || 
                      ('TX' + Math.floor(100000 + Math.random() * 900000));

  // 2. Table d'alias de variables pour résoudre tous les cas {amount}, {balance}, {ref}, etc.
  const resolvedParams = {
    ...params,
    ref: fallbackRef,
    reference: fallbackRef,
    amount: params.amount !== undefined ? params.amount : (params.solde !== undefined ? params.solde : params.balance),
    solde: params.solde !== undefined ? params.solde : (params.amount !== undefined ? params.amount : params.balance),
    balance: params.balance !== undefined ? params.balance : (params.newBalance !== undefined ? params.newBalance : params.amount),
    newBalance: params.newBalance !== undefined ? params.newBalance : (params.new_balance !== undefined ? params.new_balance : params.balance),
    new_balance: params.new_balance !== undefined ? params.new_balance : (params.newBalance !== undefined ? params.newBalance : params.balance),
    recipient: params.recipient?.name || params.recipient_name || params.recipient || 'Destinataire',
    recipient_name: params.recipient_name || params.recipient?.name || params.recipient || 'Destinataire',
    fee: params.fee !== undefined ? params.fee : params.fees,
    fees: params.fees !== undefined ? params.fees : params.fee,
    total: params.total !== undefined ? params.total : params.limit,
    limit: params.limit !== undefined ? params.limit : params.total,
    spent: params.spent !== undefined ? params.spent : 0,
    remaining: params.remaining !== undefined ? params.remaining : 0
  };

  // 3. Remplacement de toutes les variables {paramName}
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    const val = resolvedParams[paramName];
    if (val !== undefined && val !== null) {
      return typeof val === 'number' ? val.toLocaleString('fr-FR') : String(val);
    }
    // Si c'est {ref} ou {reference} non fourni dans l'objet d'origine
    if (paramName === 'ref' || paramName === 'reference') {
      return fallbackRef;
    }
    return match;
  });
}

/**
 * Aplatit les clés d'un objet
 */
function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(flattenKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function extractPlaceholders(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{(\w+)\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, '')).sort();
}

/**
 * Vérifie la parité stricte des catalogues et de leurs variables
 */
function verifyCatalogParity() {
  const errors = [];
  const frKeys = flattenKeys(catalogs.fr).sort();
  const fonKeys = flattenKeys(catalogs.fon).sort();
  const yorKeys = flattenKeys(catalogs.yor).sort();

  const missingInFon = frKeys.filter((k) => !fonKeys.includes(k));
  const extraInFon = fonKeys.filter((k) => !frKeys.includes(k));
  const missingInYor = frKeys.filter((k) => !yorKeys.includes(k));
  const extraInYor = yorKeys.filter((k) => !frKeys.includes(k));

  if (missingInFon.length > 0) errors.push(`Clés manquantes en Fongbé : ${missingInFon.join(', ')}`);
  if (extraInFon.length > 0) errors.push(`Clés en trop en Fongbé : ${extraInFon.join(', ')}`);
  if (missingInYor.length > 0) errors.push(`Clés manquantes en Yoruba : ${missingInYor.join(', ')}`);
  if (extraInYor.length > 0) errors.push(`Clés en trop en Yoruba : ${extraInYor.join(', ')}`);

  // Vérification de la couverture de tous les alias
  for (const dialogKey of Object.keys(KEY_ALIASES)) {
    for (const l of ['fr', 'fon', 'yor']) {
      const res = t(l, dialogKey);
      if (res.includes('MISSING_TRANSLATION')) {
        errors.push(`Clé dialogue non résolue : '${dialogKey}' pour langue '${l}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    totalKeys: frKeys.length
  };
}

module.exports = {
  catalogs,
  t,
  KEY_ALIASES,
  verifyCatalogParity
};