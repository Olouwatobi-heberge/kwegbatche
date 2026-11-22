import { config } from '../config/index.js';

/**
 * Mappeur de chiffres Fongbé -> Valeur numérique (Caki = 1000)
 */
const FON_NUMBERS = {
  'ɖokpo': 1000,
  'we': 2000,
  'atɔn': 3000,
  'ɛnɛ': 4000,
  'atɔɔn': 5000,
  'ayizɛn': 6000,
  'tɛnwe': 7000,
  'tɛnwe adaɖe': 7500,
  'tantɔn': 8000,
  'tɛnnɛ': 9000,
  'wo': 10000,
  'afɔtɔn': 15000,
  'ko': 20000,
  'ko atɔɔn': 25000,
  'kanɖe wo': 50000
};

/**
 * Mappeur de chiffres Yoruba -> Valeur numérique (ẹgbẹ̀rún = 1000)
 */
const YOR_NUMBERS = {
  'ẹgbẹ̀rún': 1000,
  'ẹgbẹ̀rún méjì': 2000,
  'ẹgbẹ̀rún mẹ́ta': 3000,
  'ẹgbẹ̀rún mẹ́rin': 4000,
  'ẹgbẹ̀rún márùn-ún': 5000,
  'ẹgbẹ̀rún mẹ́fà': 6000,
  'ẹgbẹ̀rún méje': 7000,
  'ẹgbẹ̀rún mẹ́jọ': 8000,
  'ẹgbẹ̀rún mẹ́sàn-án': 9000,
  'ẹgbẹ̀rún mẹ́wàá': 10000,
  'ẹgbẹ̀rún mẹ́ẹ̀ẹ́dógún': 15000,
  'ẹgbẹ̀rún ogún': 20000,
  'ẹgbẹ̀rún mẹ́ẹ̀ẹ́dọ́gbọ̀n': 25000,
  'ẹgbẹ̀rún àádọ́ta': 50000
};

/**
 * Analyse NLU avec fallback robuste sur le corpus bilingue (FR / FON / YOR)
 */
export async function understandIntent(text, lang = 'fr') {
  if (!text || typeof text !== 'string') {
    return { intent: 'inconnu', confidence: 0.0, entities: {} };
  }

  const clean = text.trim().toLowerCase();

  // 1. Détection CONFIRMATION
  if (/^(oui|confirmer|valider|d'accord|c'est bon|ɛɛn|un ɖɔ ɛ|é nyɔ́|bẹ́ẹ̀ni|mo fọwọ́|ó dára)/i.test(clean)) {
    return {
      intent: 'confirmer',
      confidence: 0.95,
      entities: { confirmation: true }
    };
  }

  // 2. Détection ANNULATION
  if (/^(non|annuler|stop|refuser|quitter|ɛo|gbìdí|rárá|fagilé)/i.test(clean)) {
    return {
      intent: 'annuler',
      confidence: 0.95,
      entities: { cancellation: true }
    };
  }

  // 3. Détection HORS SUJET
  if (/(météo|temps|blague|ayihunxó|àwàdà|capitale|olú-ìlú|musique|hanjinú|orin|appelles|nyikɔ|orúkọ|whatsapp)/i.test(clean)) {
    return {
      intent: 'hors_sujet',
      confidence: 0.92,
      entities: {}
    };
  }

  // 4. Détection SOLDE
  if (/(solde|compte|combien.*reste|akwɛ.*ɖó|kpo nú mì|iyóku.*owó|àkáǹtì|iye tó kù|gankpò|àpò owó|kpɔ́n solde|ṣàyẹ̀wò solde)/i.test(clean)) {
    return {
      intent: 'consulter_solde',
      confidence: 0.90,
      entities: {}
    };
  }

  // 5. Détection FRAIS
  if (/(frais|coûte|combien.*payer|tarifs|sú ná|tinmɛ frais|ṣàlàyé frais|èló ni ó náà|dépôt|retrait|ìyọwó|ìfowópamọ́)/i.test(clean)) {
    // Extraction montant éventuel pour calcul prédictif
    const amountMatch = clean.match(/(\d+[\d\s]*)/);
    let amount = amountMatch ? parseInt(amountMatch[0].replace(/\s+/g, ''), 10) : null;
    
    return {
      intent: 'comprendre_frais',
      confidence: 0.88,
      entities: amount ? { amount } : {}
    };
  }

  // 6. Détection BUDGET
  if (/(budget|dépensé|dépenses|zán|ìnáwó|vodúngbe|ọ̀sẹ̀|oṣù|sùn|résumé|àkópọ̀)/i.test(clean)) {
    return {
      intent: 'consulter_budget',
      confidence: 0.88,
      entities: {}
    };
  }

  // 7. Détection TRANSFERT D'ARGENT
  if (/(envoyer|transférer|sɛ|sɛsɛdó|ránṣẹ́|ìfiránṣẹ́|virement|transfert|donne|donner)/i.test(clean)) {
    let amount = null;
    let recipient = null;

    // Détection chiffres arabes
    const numMatch = clean.match(/(\d+[\d\s]*)/);
    if (numMatch) {
      amount = parseInt(numMatch[0].replace(/\s+/g, ''), 10);
    } else {
      // Détection montants traditionnels Fon (caki ...)
      for (const [key, val] of Object.entries(FON_NUMBERS)) {
        if (clean.includes(key)) {
          amount = val;
          break;
        }
      }
      // Détection montants traditionnels Yoruba (ẹgbẹ̀rún ...)
      if (!amount) {
        for (const [key, val] of Object.entries(YOR_NUMBERS)) {
          if (clean.includes(key)) {
            amount = val;
            break;
          }
        }
      }
    }

    // Détection destinataire (ex: "à Amina", "dó Koffi", "sí Fatou", "pour Boris")
    const destMatch = clean.match(/(?:à|pour|vers|dó|ná|sí|fún)\s+([a-zA-ZÀ-ÿ\s]+)/i);
    if (destMatch) {
      recipient = destMatch[1].trim().replace(/\.$/, '');
    }

    return {
      intent: 'preparer_transfert',
      confidence: 0.89,
      entities: {
        ...(amount ? { amount } : {}),
        ...(recipient ? { recipient } : {})
      }
    };
  }

  // Fallback si confiance insuffisante
  return {
    intent: 'inconnu',
    confidence: 0.40,
    entities: {}
  };
}