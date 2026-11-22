const fs = require("node:fs");
const path = require("node:path");

function loadCatalog(lang) {
  const filePath = path.join(__dirname, `catalog.${lang}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Catalogue introuvable : ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

const catalogs = {
  fr: loadCatalog("fr"),
  fon: loadCatalog("fon"),
  yor: loadCatalog("yor"),
};

/**
 * Table d'alias reliant les noms techniques de la machine de dialogue aux clés du catalogue
 */
const KEY_ALIASES = {
  fallback_rephrase: "erreurs.incompris",
  clarification_needed: "erreurs.incompris",
  balance_recap: "solde.reponse",
  balance_info: "solde.reponse",
  budget_info: "budget.resume",
  budget_recap: "budget.resume",
  fees_info: "frais.reponse",
  transfer_recap: "transfert.recap",
  transfer_success: "transfert.succes",
  transfer_cancelled: "transfert.annule",
  clarification_needed: "erreurs.incompris",
  out_of_scope: "hors_sujet",
  insufficient_balance: "erreurs.solde_insuffisant",
  unknown_recipient: "erreurs.destinataire_inconnu",
  invalid_amount: "erreurs.montant_invalide",
  antifraud_blocked: "antifraude.bloque",
  antifraud_warning_urgency: "antifraude.alerte_urgence",
  antifraud_warning_pin: "antifraude.alerte_pin",
};

/**
 * Recherche une clé dans un objet (gère la dot-notation "a.b" et les alias)
 */
function getValue(obj, keyPath) {
  if (!obj || typeof obj !== "object") return undefined;

  // 1. Accès direct ou via alias
  const targetKey = KEY_ALIASES[keyPath] || keyPath;

  if (obj[targetKey] !== undefined) return obj[targetKey];

  // 2. Descente récursive (ex: 'solde.reponse')
  const parts = targetKey.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Traduit un texte avec interpolation des paramètres
 */
function t(lang = "fr", key, params = {}) {
  const normalizedLang = lang === "yo" ? "yor" : lang || "fr";
  const catalog = catalogs[normalizedLang] || catalogs.fr;

  let template = getValue(catalog, key);

  // Fallback sur le catalogue français si clé manquante dans la langue locale
  if (template === undefined && catalog !== catalogs.fr) {
    template = getValue(catalogs.fr, key);
  }

  // Si la clé est introuvable même en français
  if (template === undefined) {
    return `[MISSING_TRANSLATION:${normalizedLang}:${key}]`;
  }

  if (typeof template !== "string") {
    return String(template);
  }

  // Remplacement des variables {amount}, {remaining}, etc.
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? String(params[paramName]) : match;
  });
}

/**
 * Aplatit les clés d'un objet
 */
function flattenKeys(obj, prefix = "") {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Array.isArray(obj[k])
    ) {
      keys = keys.concat(flattenKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function extractPlaceholders(str) {
  if (typeof str !== "string") return [];
  const matches = str.match(/\{(\w+)\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, "")).sort();
}

/**
 * Vérifie la parité stricte et la présence des clés techniques
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

  if (missingInFon.length > 0)
    errors.push(`Clés manquantes en Fongbé : ${missingInFon.join(", ")}`);
  if (extraInFon.length > 0)
    errors.push(`Clés en trop en Fongbé : ${extraInFon.join(", ")}`);
  if (missingInYor.length > 0)
    errors.push(`Clés manquantes en Yoruba : ${missingInYor.join(", ")}`);
  if (extraInYor.length > 0)
    errors.push(`Clés en trop en Yoruba : ${extraInYor.join(", ")}`);

  // Vérification des placeholders
  for (const k of frKeys) {
    const frVal = getValue(catalogs.fr, k);
    const fonVal = getValue(catalogs.fon, k);
    const yorVal = getValue(catalogs.yor, k);

    const frPlaceholders = extractPlaceholders(frVal);
    const fonPlaceholders = extractPlaceholders(fonVal);
    const yorPlaceholders = extractPlaceholders(yorVal);

    if (JSON.stringify(frPlaceholders) !== JSON.stringify(fonPlaceholders)) {
      errors.push(
        `Placeholders divergents sur '${k}' : FR [${frPlaceholders}] != FON [${fonPlaceholders}]`,
      );
    }
    if (JSON.stringify(frPlaceholders) !== JSON.stringify(yorPlaceholders)) {
      errors.push(
        `Placeholders divergents sur '${k}' : FR [${frPlaceholders}] != YOR [${yorPlaceholders}]`,
      );
    }
  }

  // Vérification de la couverture des clés du dialogue
  for (const [dialogKey, targetKey] of Object.entries(KEY_ALIASES)) {
    for (const l of ["fr", "fon", "yor"]) {
      const res = t(l, dialogKey);
      if (res.includes("MISSING_TRANSLATION")) {
        errors.push(
          `Clé dialogue non résolue : '${dialogKey}' pour langue '${l}'`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    totalKeys: frKeys.length,
  };
}

module.exports = {
  catalogs,
  t,
  KEY_ALIASES,
  verifyCatalogParity,
};
