/**
 * KwèGbaTché : script du mode secours hors ligne.
 * Utilisé uniquement si le serveur ne répond pas pendant la démo.
 * Textes repris des réponses réelles du backend (données de démo seedées :
 * solde 39 975 F, frais de 100 F pour 5 000 F, contact Koffi).
 */
window.KWG_SECOURS = {
  fr: {
    consulter_solde: {
      heard: 'Quel est mon solde ?',
      intent: 'consulter_solde',
      reply: 'Votre solde disponible est de 39 975 Francs CFA.'
    },
    comprendre_frais: {
      heard: 'Quels sont les frais pour envoyer cinq mille francs ?',
      intent: 'comprendre_frais',
      reply: 'Pour un transfert de 5 000 FCFA, les frais sont de 100 FCFA, soit un total débité de 5 100 FCFA.'
    },
    preparer_transfert: {
      heard: 'Envoie cinq mille francs à Koffi',
      intent: 'transferer',
      reply: "Vous allez envoyer 5 000 FCFA à Koffi. Les frais sont de 100 FCFA, pour un total de 5 100 FCFA. Confirmez-vous l'opération ?",
      yes: 'Oui.',
      done: 'Transfert de 5 000 FCFA vers Koffi effectué avec succès. Référence : DEMO.'
    }
  },
  fon: {
    consulter_solde: {
      heard: 'Nabi solde ce ɖè?',
      fr: 'Quel est mon solde ?',
      intent: 'consulter_solde',
      reply: 'Solde towe e ɖò te ɔ nyí flán CFA 39 975.'
    },
    comprendre_frais: {
      heard: 'Nabi wɛ frais ná sɛ caki atɔɔn?',
      fr: 'Quels sont les frais pour envoyer cinq mille francs ?',
      intent: 'comprendre_frais',
      reply: 'Ná sɛsɛdó flán 5 000 tɔn, frais ɔ nyí flán 100, bɔ bǐ bló flán 5 100.'
    },
    preparer_transfert: {
      heard: 'Sɛ caki atɔɔn nǔ Koffi',
      fr: 'Envoie cinq mille francs à Koffi',
      intent: 'transferer',
      reply: 'A jlo ná sɛ flán 5 000 dó Koffi. Frais nyí flán 100, akwɛ bǐ e ná ɖè ɔ nyí flán 5 100. A ɖɔ ɛ à?',
      yes: 'Ɛɛn.',
      done: 'Sɛsɛdó flán 5 000 tɔn dó Koffi yì ganji. Wuntun : DEMO.'
    }
  },
  yor: {
    consulter_solde: {
      heard: 'Èló ni ìyókù owó mi?',
      fr: 'Quel est mon solde ?',
      intent: 'consulter_solde',
      reply: 'Ìyókù owó rẹ jẹ́ fránkì CFA 39 975.'
    },
    comprendre_frais: {
      heard: 'Kí ni frais láti fi ẹgbẹ̀rún márùn-ún fránkì ránṣẹ́?',
      fr: 'Quels sont les frais pour envoyer cinq mille francs ?',
      intent: 'comprendre_frais',
      reply: 'Fún ìfiránṣẹ́ fránkì 5 000, frais jẹ́ fránkì 100, àpapọ̀ rẹ̀ jẹ́ fránkì 5 100.'
    },
    preparer_transfert: {
      heard: 'Fi ẹgbẹrun marun ranṣẹ si Koffi',
      fr: 'Envoie cinq mille francs à Koffi',
      intent: 'transferer',
      reply: 'O fẹ́ fi fránkì 5 000 ránṣẹ́ sí Koffi. Frais jẹ́ fránkì 100, àpapọ̀ owó tí a ó gbà jẹ́ fránkì 5 100. Ṣé o fọwọ́ sí i?',
      yes: 'Bẹ́ẹ̀ni.',
      done: 'Ìfiránṣẹ́ fránkì 5 000 sí Koffi ti kẹ́sẹjárí. Nọ́mbà ìdánimọ̀ : DEMO.'
    }
  }
};
