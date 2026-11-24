// src/ml/intent.scorer.js
// Score de confiance de l'intention, calculé pour chaque phrase.
//
// Méthode : chaque phrase de référence (fr, fon, yo) du dataset est
// transformée en vecteur TF-IDF de trigrammes de caractères. La phrase
// entendue est comparée à toutes les phrases de référence (similarité
// cosinus). Pour chaque intention on fait la moyenne des 3 meilleures
// similarités, puis un softmax transforme ces valeurs en probabilités qui
// somment à 1.
//
// Honnêteté : si la phrase entendue figure telle quelle dans le dataset, on
// l'exclut des références (leave-one-out). Le score mesure donc la
// ressemblance avec les AUTRES phrases, pas une simple recopie.
//
// Ce module ne décide pas de l'intention : il mesure seulement la confiance.
// La décision reste celle du moteur NLU existant (nlu.client.js).

const dataset = require('../i18n/utterances.dataset.json');
const { normalizeText } = require('./nlu.client');

const TEMPERATURE = 0.05;
const TOP_K = 3;
const LANG_FIELDS = ['fr', 'fon', 'yo'];

// Noms de la machine de dialogue -> noms du dataset
const MACHINE_TO_DATASET = {
  transferer: 'preparer_transfert',
  preparer_transfert: 'preparer_transfert',
  consulter_solde: 'consulter_solde',
  comprendre_frais: 'comprendre_frais',
  consulter_budget: 'consulter_budget',
  confirmer: 'confirmer',
  annuler: 'annuler',
  hors_sujet: 'hors_sujet',
};

function trigrams(text) {
  const clean = normalizeText(text);
  if (!clean) return [];
  const grams = [];
  for (const word of clean.split(' ')) {
    const padded = ` ${word} `;
    if (padded.length < 3) continue;
    for (let i = 0; i <= padded.length - 3; i += 1) grams.push(padded.slice(i, i + 3));
  }
  return grams;
}

function termFrequencies(grams) {
  const tf = new Map();
  for (const g of grams) tf.set(g, (tf.get(g) || 0) + 1);
  return tf;
}

let model = null;

function buildModel() {
  const docs = [];
  for (const row of Array.isArray(dataset) ? dataset : []) {
    if (!row || !row.intent) continue;
    for (const field of LANG_FIELDS) {
      const text = row[field];
      if (!text || !String(text).trim()) continue;
      const grams = trigrams(text);
      if (!grams.length) continue;
      docs.push({ intent: row.intent, norm: normalizeText(text), tf: termFrequencies(grams) });
    }
  }
  const df = new Map();
  for (const d of docs) for (const g of d.tf.keys()) df.set(g, (df.get(g) || 0) + 1);
  const n = docs.length;
  const idf = (g) => Math.log((n + 1) / ((df.get(g) || 0) + 1)) + 1;
  for (const d of docs) {
    d.vec = new Map();
    let norm2 = 0;
    for (const [g, c] of d.tf) {
      const w = c * idf(g);
      d.vec.set(g, w);
      norm2 += w * w;
    }
    d.norm2 = Math.sqrt(norm2) || 1;
  }
  const intents = [...new Set(docs.map((d) => d.intent))];
  return { docs, idf, intents, size: n };
}

function getModel() {
  if (!model) model = buildModel();
  return model;
}

/**
 * Calcule la probabilité de chaque intention pour un texte.
 * @param {string} text Phrase transcrite
 * @param {string} [chosenIntent] Intention retenue par le NLU (nom machine ou dataset)
 * @returns {null | { intent: string, score: number, scores: Record<string, number>, method: string, references: number, excludedExact: number }}
 */
function scoreIntent(text, chosenIntent) {
  try {
    const grams = trigrams(text);
    if (!grams.length) return null;
    const m = getModel();
    if (!m.docs.length) return null;

    const tf = termFrequencies(grams);
    const q = new Map();
    let qn2 = 0;
    for (const [g, c] of tf) {
      const w = c * m.idf(g);
      q.set(g, w);
      qn2 += w * w;
    }
    const qn = Math.sqrt(qn2) || 1;
    const queryNorm = normalizeText(text);

    const sims = {};
    for (const it of m.intents) sims[it] = [];
    let excluded = 0;
    for (const d of m.docs) {
      if (d.norm === queryNorm) {
        excluded += 1;
        continue;
      }
      let dot = 0;
      for (const [g, w] of q) {
        const dw = d.vec.get(g);
        if (dw) dot += w * dw;
      }
      sims[d.intent].push(dot / (qn * d.norm2));
    }

    const best = {};
    for (const it of m.intents) {
      const topSims = sims[it].sort((a, b) => b - a).slice(0, TOP_K);
      best[it] = topSims.length ? topSims.reduce((acc, v) => acc + v, 0) / topSims.length : 0;
    }

    const maxSim = Math.max(...Object.values(best));
    let total = 0;
    const exps = {};
    for (const it of m.intents) {
      exps[it] = Math.exp((best[it] - maxSim) / TEMPERATURE);
      total += exps[it];
    }
    const scores = {};
    for (const it of m.intents) scores[it] = exps[it] / total;

    const ranked = [...m.intents].sort((a, b) => scores[b] - scores[a]);
    const top = ranked[0];
    const target = MACHINE_TO_DATASET[chosenIntent] || chosenIntent || top;
    const score = typeof scores[target] === 'number' ? scores[target] : 0;

    return {
      intent: target,
      score: Math.round(score * 1000) / 1000,
      top,
      runnerUp: ranked.find((it) => it !== (MACHINE_TO_DATASET[chosenIntent] || chosenIntent || top)) || null,
      scores,
      method: 'similarite_trigrammes_tfidf',
      references: m.size - excluded,
      excludedExact: excluded,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Évaluation leave-one-out sur le dataset : chaque phrase est classée en
 * l'excluant des références. Sert à donner un chiffre vérifiable au jury.
 * @returns {{ accuracy: number, total: number, byLang: Record<string, { ok: number, total: number }> }}
 */
function evaluateLeaveOneOut() {
  const byLang = {};
  let ok = 0;
  let total = 0;
  for (const row of Array.isArray(dataset) ? dataset : []) {
    for (const field of LANG_FIELDS) {
      const text = row && row[field];
      if (!text || !String(text).trim()) continue;
      const r = scoreIntent(text);
      if (!r) continue;
      byLang[field] = byLang[field] || { ok: 0, total: 0 };
      byLang[field].total += 1;
      total += 1;
      if (r.top === row.intent) {
        byLang[field].ok += 1;
        ok += 1;
      }
    }
  }
  return { accuracy: total ? ok / total : 0, total, byLang };
}

module.exports = { scoreIntent, evaluateLeaveOneOut, trigrams };
