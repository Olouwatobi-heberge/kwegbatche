const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../../src/db/seed');
const { mockTranscriptFor, frenchFor, transcribeAudio } = require('../../src/ml/asr.client');
const { analyzeForDialog } = require('../../src/ml/nlu.client');
const { scoreIntent, evaluateLeaveOneOut } = require('../../src/ml/intent.scorer');

const LANGS = ['fr', 'fon', 'yor'];
const CASES = [
  ['consulter_solde', 'consulter_solde'],
  ['preparer_transfert', 'transferer'],
  ['comprendre_frais', 'comprendre_frais'],
  ['confirmer', 'confirmer'],
];

describe('Score de confiance de l intention', () => {
  before(() => {
    seed();
  });

  for (const lang of LANGS) {
    test(`${lang} : un score réel entre 0 et 1 pour chaque cas, sans changer la décision`, async () => {
      for (const [scenario, expectedIntent] of CASES) {
        const text = mockTranscriptFor(lang, scenario);
        const nlu = await analyzeForDialog(text, lang);
        assert.equal(nlu.intent, expectedIntent, text);
        const r = scoreIntent(text, nlu.intent);
        assert.ok(r, `score absent pour ${text}`);
        assert.ok(r.score > 0 && r.score <= 1, `${text} -> ${r.score}`);
        const sum = Object.values(r.scores).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1) < 1e-9, `somme ${sum}`);
        assert.ok(r.references > 100);
        // La décision NLU reste identique après le calcul du score
        const again = await analyzeForDialog(text, lang);
        assert.equal(again.intent, nlu.intent);
      }
    });
  }

  test('le score dépend de la phrase (pas de valeur fixe)', () => {
    const a = scoreIntent('Quel est mon solde ?', 'consulter_solde').score;
    const b = scoreIntent('Quels sont les frais pour envoyer cinq mille francs ?', 'comprendre_frais').score;
    assert.notEqual(a, b);
  });

  test('texte vide ou invalide : pas de score, pas d erreur', () => {
    assert.equal(scoreIntent(''), null);
    assert.equal(scoreIntent(null), null);
    assert.equal(scoreIntent('?!'), null);
  });

  test('évaluation leave-one-out sur le dataset au-dessus de 75 %', () => {
    const r = evaluateLeaveOneOut();
    assert.ok(r.total >= 150, `total ${r.total}`);
    assert.ok(r.accuracy >= 0.75, `accuracy ${r.accuracy}`);
  });
});

describe('Langue et mode secours', () => {
  test('traduction française des phrases fon et yoruba de la démo', () => {
    assert.equal(frenchFor(mockTranscriptFor('fon', 'preparer_transfert')), 'Envoie cinq mille francs à Koffi');
    assert.equal(frenchFor(mockTranscriptFor('yor', 'preparer_transfert')), 'Envoie cinq mille francs à Koffi');
    assert.equal(frenchFor(mockTranscriptFor('fon', 'consulter_solde')), 'Quel est mon solde ?');
    assert.ok(frenchFor(mockTranscriptFor('yor', 'comprendre_frais')).includes('frais'));
    assert.equal(frenchFor('phrase inconnue'), '');
    assert.equal(frenchFor(''), '');
  });

  test('orthographe fon : caki', () => {
    assert.match(mockTranscriptFor('fon', 'preparer_transfert'), /caki/);
    assert.match(mockTranscriptFor('fon', 'comprendre_frais'), /caki/);
  });

  test('forceMock rejoue le cas demandé sans appeler le service ASR', async () => {
    for (const lang of LANGS) {
      const r = await transcribeAudio(Buffer.alloc(16), 'audio/wav', lang, {
        scenario: 'frais',
        forceMock: true,
      });
      assert.equal(r.isMock, true);
      assert.equal(r.scenario, 'comprendre_frais');
      assert.equal(r.text, mockTranscriptFor(lang, 'comprendre_frais'));
    }
  });
});
