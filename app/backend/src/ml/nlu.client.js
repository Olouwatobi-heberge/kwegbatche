// src/ml/nlu.client.js
const dataset = require("../i18n/utterances.dataset.json");

/**
 * Mappeur de chiffres traditionnels Fongbé (Caki = 1 000 F)
 */
const FON_NUMBERS = {
  "caki ɖokpo": 1000,
  "caki dokpo": 1000,
  "caki we": 2000,
  "caki atɔn": 3000,
  "caki aton": 3000,
  "caki ɛnɛ": 4000,
  "caki ene": 4000,
  "caki atɔ́ɔ́n": 5000,
  "caki atɔɔn": 5000,
  "caki atoon": 5000,
  "caki ayizɛn": 6000,
  "caki ayizen": 6000,
  "caki tɛnwe adaɖe": 7500,
  "caki tenwe adade": 7500,
  "caki tɛnwe": 7000,
  "caki tenwe": 7000,
  "caki tantɔn": 8000,
  "caki tanton": 8000,
  "caki tɛnnɛ": 9000,
  "caki tenne": 9000,
  "caki wo": 10000,
  "caki afɔtɔn": 15000,
  "caki afoton": 15000,
  "caki ko": 20000,
  "caki ko atɔɔn": 25000,
  "caki ko atoon": 25000,
  "caki gbàn": 30000,
  "caki gban": 30000,
  "caki kanɖe": 40000,
  "caki kande": 40000,
  "caki kanɖe wo": 50000,
  "caki kande wo": 50000,
  "caki kandewo": 50000,
  // Formes directes et argot Momo
  afɔtɔn: 15000,
  afoton: 15000,
  atɔ́ɔ́n: 5000,
  atoon: 5000,
  wo: 10000,
  // ko: 20000,
  gbàn: 30000,
  gban: 30000,
  kanɖé: 40000,
  kande: 40000,
};

/**
 * Mappeur de chiffres traditionnels Yorùbá (Ẹgbẹ̀rún = 1 000 F)
 */
const YOR_NUMBERS = {
  "ẹgbẹ̀rún kan": 1000,
  "egberun kan": 1000,
  "ẹgbẹ̀rún méjì": 2000,
  "egberun meji": 2000,
  "ẹgbẹ̀rún mẹ́ta": 3000,
  "egberun meta": 3000,
  "ẹgbẹ̀rún mẹ́rin": 4000,
  "egberun merin": 4000,
  "ẹgbẹ̀rún márùn-ún": 5000,
  "egberun marun": 5000,
  "ẹgbẹ̀rún mẹ́fà": 6000,
  "egberun mefa": 6000,
  "ẹgbẹ̀rún méje": 7000,
  "egberun meje": 7000,
  "ẹgbẹ̀rún méje àti ẹ̀ẹ́dẹ́gbẹ̀ta": 7500,
  "egberun meje ati eedegbeta": 7500,
  "ẹgbẹ̀rún mẹ́jọ": 8000,
  "egberun mejo": 8000,
  "ẹgbẹ̀rún mẹ́sàn-án": 9000,
  "egberun mesan": 9000,
  "ẹgbẹ̀rún mẹ́wàá": 10000,
  "egberun mewaa": 10000,
  "egberun mewa": 10000,
  "ẹgbẹ̀rún mẹ́ẹ̀ẹ́dógún": 15000,
  "egberun medogun": 15000,
  "ẹgbẹ̀rún ogún": 20000,
  "egberun ogun": 20000,
  "ẹgbẹ̀rún mẹ́ẹ̀ẹ́dọ́gbọ̀n": 25000,
  "egberun medogbon": 25000,
  "ẹgbẹ̀rún àádọ́ta": 50000,
  "egberun aadota": 50000,
  ẹgbẹ̀rún: 1000,
  egberun: 1000,
};

/**
 * Nombres en Français
 */
const FR_NUMBERS = {
  mille: 1000,
  "deux mille": 2000,
  "trois mille": 3000,
  "quatre mille": 4000,
  "cinq mille": 5000,
  "six mille": 6000,
  "sept mille": 7000,
  "huit mille": 8000,
  "neuf mille": 9000,
  "dix mille": 10000,
  "quinze mille": 15000,
  "vingt mille": 20000,
  "vingt cinq mille": 25000,
  "trente mille": 30000,
  "quarante mille": 40000,
  "cinquante mille": 50000,
  "cent mille": 100000,
};

/**
 * Nettoie une chaîne pour comparaison insensible à la casse et aux diacritiques
 */
function normalizeText(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime tous les accents (ǔ, ū, é, è, etc.)
    .replace(/[ɖɗ]/g, "d")
    .replace(/[ɔo]/g, "o")
    .replace(/[ɛe]/g, "e")
    .replace(/[ṣs]/g, "s")
    .replace(/[ẹe]/g, "e")
    .replace(/[ọo]/g, "o")
    .replace(/['’`\-.,;:!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extraction robuste du montant
 */
/**
 * Extraction robuste du montant (Ligne 139)
 */
function extractAmount(rawText, cleanText, lang = "fr") {
  // 1. Chiffres explicites (ex: "15000", "5 000 f", "2000 cfa")
  const numMatch = rawText.match(/\b(\d+[\d\s]*)\b/);
  if (numMatch) {
    const val = parseInt(numMatch[1].replace(/\s+/g, ""), 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // Fonction utilitaire pour tester un mot entier (évite que "ko" matche "koffi")
  const matchWholeWord = (text, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(text);
  };

  // 2. Si langue Français ou détection de mots français
  const frKeys = Object.keys(FR_NUMBERS).sort((a, b) => b.length - a.length);
  for (const k of frKeys) {
    const normK = normalizeText(k);
    if (matchWholeWord(cleanText, normK)) {
      return FR_NUMBERS[k];
    }
  }

  // 3. Fongbé : tri par longueur
  const fonKeys = Object.keys(FON_NUMBERS).sort((a, b) => b.length - a.length);
  for (const k of fonKeys) {
    const normK = normalizeText(k);
    if (matchWholeWord(cleanText, normK)) {
      return FON_NUMBERS[k];
    }
  }

  // 4. Yorùbá
  const yorKeys = Object.keys(YOR_NUMBERS).sort((a, b) => b.length - a.length);
  for (const k of yorKeys) {
    const normK = normalizeText(k);
    if (matchWholeWord(cleanText, normK)) {
      return YOR_NUMBERS[k];
    }
  }

  return 5000; // Montant standard par défaut
}

/**
 * Extraction robuste du destinataire
 */
function extractRecipient(rawText, cleanText) {
  // Prépositions multilingues : nu / na / fun / pour / a / vers / do / si
  const patterns = [
    /(?:nu|na|fun|pour|vers|a|si|do)\s+([a-z]+)/i,
    /sɛ\s+(?:.*)\s+nu\s+([a-z]+)/i,
    /(?:envoyer|transferer)\s+(?:.*)\s+a\s+([a-z]+)/i,
  ];

  for (const pat of patterns) {
    const m = cleanText.match(pat);
    if (m && m[1]) {
      const candidate = m[1].trim();
      const stopWords = [
        "mi",
        "nye",
        "we",
        "cfa",
        "xof",
        "kwe",
        "akwe",
        "gankpwe",
        "solde",
        "frais",
        "budget",
        "gon",
        "tche",
        "owo",
      ];
      if (!stopWords.includes(candidate)) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  }

  return "Koffi"; // Destinataire par défaut si non trouvé
}

/**
 * Analyse NLU avec double moteur :
 * 1. Correspondance exacte/approchée sur le Dataset
 * 2. Moteur Heuristique & Regex multilingue (FR / FON / YOR)
 */
async function understandIntent(text, lang = "fr") {
  if (!text || typeof text !== "string") {
    return { intent: "inconnu", confidence: 0.0, entities: {} };
  }

  const clean = normalizeText(text);

  // =========================================================================
  // NIVEAU 1 : RECHERCHE DIRECTE DANS LE DATASET DE RÉFÉRENCE
  // =========================================================================
  if (Array.isArray(dataset)) {
    for (const item of dataset) {
      const frNorm = normalizeText(item.fr);
      const fonNorm = normalizeText(item.fon);
      const yoNorm = normalizeText(item.yo);

      if (clean === frNorm || clean === fonNorm || clean === yoNorm) {
        const entities = {};
        if (item.amount) {
          entities.amount = item.amount;
          entities.montant = item.amount;
        }
        if (item.recipient) {
          entities.recipient = item.recipient;
          entities.destinataire = item.recipient;
        }
        if (item.intent === "confirmer") entities.confirmation = true;
        if (item.intent === "annuler") entities.cancellation = true;

        return {
          intent: item.intent,
          confidence: 0.96,
          entities,
        };
      }
    }
  }

  // =========================================================================
  // NIVEAU 2 : EXTRACTION COMMUNE DES ENTITÉS
  // =========================================================================
  const extractedAmount = extractAmount(text, clean, lang);
  const extractedRecipient = extractRecipient(text, clean);

  // =========================================================================
  // NIVEAU 3 : CLASSIFICATION PAR RÈGLES / INTENTIONS
  // =========================================================================

  // 1. CONFIRMATION
  if (
    /^(oui|ok|confirmer|valider|d accord|c est bon|een|un do e|e nyo|beeni|mo fowo|o dara|yio|e ya|hen)$/i.test(
      clean,
    )
  ) {
    return {
      intent: "confirmer",
      confidence: 0.95,
      entities: { confirmation: true },
    };
  }

  // 2. ANNULATION
  if (
    /^(non|annuler|stop|refuser|quitter|eo|gbidi|rara|fagile|gbe|e gbodo|o ti)$/i.test(
      clean,
    )
  ) {
    return {
      intent: "annuler",
      confidence: 0.95,
      entities: { cancellation: true },
    };
  }

  // 3. HORS SUJET
  if (
    /(meteo|temps|blague|ayihunxo|awada|capitale|olu ilu|musique|hanjinu|orin|appelles|nyiko|oruko|whatsapp)/i.test(
      clean,
    )
  ) {
    return {
      intent: "hors_sujet",
      confidence: 0.92,
      entities: {},
    };
  }

  // 4. TRANSFERT D'ARGENT
  if (
    /(envoi|envoy|transferer|transfere|se|sesedo|ranse|ifiranse|virement|transfert|donne|donner|gankpwe|caki|egberun)/i.test(
      clean,
    )
  ) {
    return {
      intent: "preparer_transfert",
      confidence: 0.92,
      entities: {
        amount: extractedAmount,
        montant: extractedAmount,
        recipient: extractedRecipient,
        destinataire: extractedRecipient,
      },
    };
  }

  // 5. SOLDE
  if (
    /(solde|compte|combien.*reste|akwe|kwe|owó|owo|balance|kpo nu mi|akanti|gankpo|apo owo)/i.test(
      clean,
    )
  ) {
    return {
      intent: "consulter_solde",
      confidence: 0.9,
      entities: {},
    };
  }

  // 6. FRAIS
  if (
    /(frais|coute|combien.*payer|tarifs|su na|fiisi|tinme frais|salaye frais|depot|retrait|iyowo|ifowopamo)/i.test(
      clean,
    )
  ) {
    return {
      intent: "comprendre_frais",
      confidence: 0.88,
      entities: {
        amount: extractedAmount,
        montant: extractedAmount,
      },
    };
  }

  // 7. BUDGET
  if (
    /(budget|depense|depenses|zan|inawo|vodungbe|ose|osu|sun|resume|akopo)/i.test(
      clean,
    )
  ) {
    return {
      intent: "consulter_budget",
      confidence: 0.88,
      entities: {},
    };
  }

  // Repli
  return {
    intent: "inconnu",
    confidence: 0.35,
    entities: {},
  };
}

// Adaptateur : sortie NLU -> format attendu par dialog.machine
const INTENT_TO_MACHINE = {
  preparer_transfert: "transferer",
  consulter_solde: "consulter_solde",
  comprendre_frais: "comprendre_frais",
  consulter_budget: "consulter_budget",
  confirmer: "confirmer",
  annuler: "annuler",
  hors_sujet: "hors_sujet",
  // alias : classifieur de Merveille et OpenAPI ML
  confirmation: "confirmer",
  demander_frais: "comprendre_frais",
  hors_domaine: "hors_sujet",
};

async function analyzeForDialog(text, lang = "fr") {
  const r = await understandIntent(text, lang);
  return {
    intent: INTENT_TO_MACHINE[r.intent] || r.intent,
    confidence: r.confidence,
    slots: r.entities || {},
    rawText: text || "",
  };
}

module.exports = {
  understandIntent,
  analyzeForDialog,
  FON_NUMBERS,
  YOR_NUMBERS,
  FR_NUMBERS,
  normalizeText,
  extractAmount,
  extractRecipient,
};
