const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../../src/db/seed');
const { mockTranscriptFor, resolveDemoScenario } = require('../../src/ml/asr.client');
const { analyzeForDialog } = require('../../src/ml/nlu.client');
const { processDialogTurn } = require('../../src/domain/dialog.machine');

function digits(value) {
  return String(value || '').replace(/\s/g, '');
}

const LANGS = ['fr', 'fon', 'yor'];

describe('Mock ASR selon la langue et le cas', () => {
  before(() => {
    seed();
  });

  for (const lang of LANGS) {
    test(`${lang} : solde, frais, transfert 5000 vers Koffi`, async () => {
      const soldeText = mockTranscriptFor(lang, 'consulter_solde');
      const soldeNlu = await analyzeForDialog(soldeText, lang);
      soldeNlu.confidence = Math.min(soldeNlu.confidence, 0.88);
      assert.equal(soldeNlu.intent, 'consulter_solde', soldeText);
      const soldeTurn = processDialogTurn({
        currentState: 'IDLE',
        session: { userId: 'usr_mama_rosine', lang, state: 'IDLE' },
        nlu: soldeNlu,
        traceId: `tr_solde_${lang}`,
      });
      assert.equal(soldeTurn.nextState, 'IDLE');
      assert.ok(digits(soldeTurn.message).includes('39975'), soldeTurn.message);

      const fraisText = mockTranscriptFor(lang, 'comprendre_frais');
      const fraisNlu = await analyzeForDialog(fraisText, lang);
      fraisNlu.confidence = Math.min(fraisNlu.confidence, 0.88);
      assert.equal(fraisNlu.intent, 'comprendre_frais', fraisText);
      const fraisTurn = processDialogTurn({
        currentState: 'IDLE',
        session: { userId: 'usr_mama_rosine', lang, state: 'IDLE' },
        nlu: fraisNlu,
        traceId: `tr_frais_${lang}`,
      });
      const fraisDigits = digits(fraisTurn.message);
      assert.ok(fraisDigits.includes('5000'), fraisTurn.message);
      assert.ok(fraisDigits.includes('5100'), fraisTurn.message);

      const transferText = mockTranscriptFor(lang, 'preparer_transfert');
      const transferNlu = await analyzeForDialog(transferText, lang);
      transferNlu.confidence = Math.min(transferNlu.confidence, 0.88);
      assert.equal(transferNlu.intent, 'transferer', transferText);
      const session = { userId: 'usr_mama_rosine', lang, state: 'IDLE' };
      const transferTurn = processDialogTurn({
        currentState: 'IDLE',
        session,
        nlu: transferNlu,
        traceId: `tr_transfert_${lang}`,
      });
      assert.equal(transferTurn.nextState, 'AWAITING_TRANSFER_CONFIRMATION');
      assert.equal(transferTurn.preparedOperation.amount, 5000);
      assert.equal(transferTurn.preparedOperation.recipient.name, 'Koffi');
      assert.ok(digits(transferTurn.message).includes('5000'), transferTurn.message);
      assert.match(transferTurn.message, /Koffi/);

      session.state = transferTurn.nextState;
      const follow = resolveDemoScenario({ sessionState: session.state });
      assert.equal(follow.scenario, 'confirmer');
      const yesNlu = await analyzeForDialog(mockTranscriptFor(lang, 'confirmer'), lang);
      assert.equal(yesNlu.intent, 'confirmer');
      const done = processDialogTurn({
        currentState: session.state,
        session,
        nlu: yesNlu,
        traceId: `tr_oui_${lang}`,
      });
      assert.equal(done.nextState, 'COMPLETED');
      assert.match(done.message, /Koffi/);
    });
  }

  test('sans scénario, la rotation est solde, transfert, frais', () => {
    let step = 0;
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      const resolved = resolveDemoScenario({ rotationStep: step });
      seen.push(resolved.scenario);
      step = resolved.nextStep;
    }
    assert.deepEqual(seen, [
      'consulter_solde',
      'preparer_transfert',
      'comprendre_frais',
      'consulter_solde',
    ]);
  });

  test('un scénario explicite prime sur la rotation et sur la confirmation', () => {
    const pinned = resolveDemoScenario({
      scenario: 'frais',
      sessionState: 'AWAITING_TRANSFER_CONFIRMATION',
      rotationStep: 2,
    });
    assert.equal(pinned.scenario, 'comprendre_frais');
    assert.equal(pinned.nextStep, 2);
  });
});
