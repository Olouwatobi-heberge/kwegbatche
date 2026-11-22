const dataset = require('../i18n/utterances.dataset.json');

/**
 * Mappeur de chiffres traditionnels Fongbé (Caki = 1 000 F)
 */
const FON_NUMBERS = {
  'caki ɖokpo': 1000,
  'caki we': 2000,
  'caki atɔn': 3000,
  'caki ɛnɛ': 4000,
  'caki atɔɔn': 5000,
  'caki ayizɛn': 6000,
  'caki tɛnwe adaɖe': 7500,
  'caki tɛnwe': 7000,
  'caki tantɔn': 8000,
  'caki tɛnnɛ': 9000,
  'caki wo': 10000,
  'caki afɔtɔn': 15000,
  'caki ko atɔɔn': 25000,
  'caki ko': 20000,
  'caki kanɖe wo': 50000
};

/**
 * Mappeur de chiffres traditionnels Yorùbá (Ẹgbẹ̀rún = 1 000 F)
 */
const YOR_NUMBERS = {
  'ẹgbẹ̀rún márùn-ún': 5000,
  'ẹgbẹ̀rún mẹ́wàá': 10000,
  'ẹgbẹ̀rún méjì': 2000,
  'ẹgbẹ̀rún mẹ́ẹ̀ẹ́dógún': 15000,
  'ẹgbẹ̀rún mẹ́ẹ̀ẹ́dọ́gbọ̀n': 25000,
  'ẹgbẹ̀rún àádọ́ta': 50000,
  'ẹgbẹ̀rún mẹ́ta': 3000,
  'ẹgbẹ̀rún méje àti ẹ̀ẹ́dẹ́gbẹ̀ta': 7500,
  'ẹgbẹ̀rún mẹ́rin': 4000,
  'ẹgbẹ̀rún mẹ́jọ': 8000,
  'ẹgbẹ̀rún mẹ́fà': 6000,
  'ẹgbẹ̀rún ogún': 20000,
  'ẹgbẹ̀rún kan': 1000,
  'ẹgbẹ̀rún': 1000
};

/**
 * Nettoie une chaîne pour comparaison insensible à la casse et ponctuation
 */
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[?,.!;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analyse NLU avec double moteur :
 * 1. Correspondance exacte/approchée sur le Dataset
 * 2. Moteur Heuristique & Regex multilingue (FR / FON / YOR)
 */
async function understandIntent(text, lang = 'fr') {
  if (!text || typeof text !== 'string') {
    return { intent: 'inconnu', confidence: 0.0, entities: {} };
  }

  const clean = normalizeText(text);

  // =========================================================================
  // NIVEAU 1 : RECHERCHE DIRECTE DANS LE DATASET DE RÉFÉRENCE
  // =========================================================================
  for (const item of dataset) {
    const frNorm = normalizeText(item.fr);
    const fonNorm = normalizeText(item.fon);
    const yoNorm = normalizeText(item.yo);

    if (clean === frNorm || clean === fonNorm || clean === yoNorm) {
      const entities = {};
      if (item.amount) entities.amount = item.amount;
      if (item.recipient) entities.recipient = item.recipient;
      if (item.intent === 'confirmer') entities.confirmation = true;
      if (item.intent === 'annuler') entities.cancellation = true;

      return {
        intent: item.intent,
        confidence: 0.96,
        entities
      };
    }
  }

  // =========================================================================
  // NIVEAU 2 : EXTRACTION DES ENTITÉS (MONTANT & DESTINATAIRE)
  // =========================================================================
  let extractedAmount = null;

  // Détection montants Fongbé
  for (const [key, val] of Object.entries(FON_NUMBERS)) {
    if (clean.includes(key)) {
      extractedAmount = val;
      break;
    }
  }

  // Détection montants Yorùbá
  if (!extractedAmount) {
    for (const [key, val] of Object.entries(YOR_NUMBERS)) {
      if (clean.includes(key)) {
        extractedAmount = val;
        break;
      }
    }
  }

  // Détection montants en chiffres arabes (ex: 5000, 10 000)
  if (!extractedAmount) {
    const numMatch = clean.match(/(\d+[\d\s]*)/);
    if (numMatch) {
      extractedAmount = parseInt(numMatch[0].replace(/\s+/g, ''), 10);
    }
  }

  // Détection destinataire (ex: "à Amina", "dó Koffi", "sí Fatou", "pour Emmanuel")
  let extractedRecipient = null;
  const destMatch = clean.match(/(?:à|pour|vers|dó|ná|sí|fún)\s+([a-zA-ZÀ-ÿ\s]+)/i);
  if (destMatch) {
    extractedRecipient = destMatch[1].trim();
  }

  // =========================================================================
  // NIVEAU 3 : CLASSIFICATION PAR RÈGLES / INTENTIONS
  // =========================================================================

  // 1. CONFIRMATION
  if (/^(oui|confirmer|valider|d'accord|c'est bon|ɛɛn|un ɖɔ ɛ|é nyɔ́|bẹ́ẹ̀ni|mo fọwọ́|ó dára)/i.test(clean)) {
    return {
      intent: 'confirmer',
      confidence: 0.95,
      entities: { confirmation: true }
    };
  }

  // 2. ANNULATION
  if (/^(non|annuler|stop|refuser|quitter|ɛo|gbìdí|rárá|fagilé)/i.test(clean)) {
    return {
      intent: 'annuler',
      confidence: 0.95,
      entities: { cancellation: true }
    };
  }

  // 3. HORS SUJET
  if (/(météo|temps|blague|ayihunxó|àwàdà|capitale|olú-ìlú|musique|hanjinú|orin|appelles|nyikɔ|orúkọ|whatsapp)/i.test(clean)) {
    return {
      intent: 'hors_sujet',
      confidence: 0.92,
      entities: {}
    };
  }

  // 4. TRANSFERT D'ARGENT
  if (/(envoyer|transférer|sɛ|sɛsɛdó|ránṣẹ́|sɛ kpo nū|sɛ kwɛ nū|sɛ ... nū|ìfiránṣẹ́|virement|transfert|donne|donner)/i.test(clean)) {
    return {
      intent: 'preparer_transfert',
      confidence: 0.90,
      entities: {
        ...(extractedAmount ? { amount: extractedAmount } : {}),
        ...(extractedRecipient ? { recipient: extractedRecipient } : {})
      }
    };
  }

  // 5. SOLDE
  if (/(solde|compte|combien.*reste|akwɛ.*ɖó|kpo nú mì|iyókù.*owó|àkáǹtì|iye tó kù|gankpò|àpò owó|kpɔ́n solde|ṣàyẹ̀wò solde)/i.test(clean)) {
    return {
      intent: 'consulter_solde',
      confidence: 0.90,
      entities: {}
    };
  }

  // 6. FRAIS
  if (/(frais|coûte|combien.*payer|tarifs|sú ná|tinmɛ frais|ṣàlàyé frais|èló ni ó náà|dépôt|retrait|ìyọwó|ìfowópamọ́)/i.test(clean)) {
    return {
      intent: 'comprendre_frais',
      confidence: 0.88,
      entities: {
        ...(extractedAmount ? { amount: extractedAmount } : {}),
        ...(extractedRecipient ? { recipient: extractedRecipient } : {})
      }
    };
  }

  // 7. BUDGET
  if (/(budget|dépensé|dépenses|zán|ìnáwó|vodúngbe|ọ̀sẹ̀|oṣù|sùn|résumé|àkópọ̀)/i.test(clean)) {
    return {
      intent: 'consulter_budget',
      confidence: 0.88,
      entities: {}
    };
  }

  // Fallback si non reconnu
  return {
    intent: 'inconnu',
    confidence: 0.35,
    entities: {}
  };
}

module.exports = {
  understandIntent,
  FON_NUMBERS,
  YOR_NUMBERS,
  normalizeText
};