# KwèGbaTché

Assistant financier vocal en fon, yoruba et français, conçu pour le mobile money.

KwèGbaTché est le projet de l'équipe du même nom pour le **GPU Challenge 2026** (Epitech Bénin, UDU Technologies, Alliance Fintech UEMOA, Payfonte). Il répond au **cas d'usage n° 2** : permettre à un utilisateur de comprendre ses frais, consulter un budget ou un solde, et préparer un transfert en parlant dans une langue locale.

Le prototype est une application web avec microphone, branchée sur un **portefeuille fictif**. Aucune opération n'est exécutée sans confirmation vocale.

## Scénarios

1. **Frais** — expliquer les frais d'une opération dans la langue de l'utilisateur.
2. **Solde ou budget** — consulter un solde ou un budget sur le portefeuille fictif.
3. **Transfert** — préparer un transfert, puis le confirmer à la voix avant toute exécution simulée.

## Stack prévue

- **ASR** : Meta MMS et Whisper (Whisper couvre le yoruba et le français, pas le fon).
- **NLU** : détection d'intentions et extraction de slots (montant, destinataire, type d'opération).
- **TTS** : Meta MMS (`mms-tts-fon`, `mms-tts-yor`) — licence CC-BY-NC, à signaler clairement.
- **Backend** : Node.js, API du portefeuille fictif.

## Arborescence

```
app/frontend/    Interface web et capture micro
app/backend/     API Node et portefeuille fictif
ml/asr/          Reconnaissance vocale et fine-tuning
ml/nlu/          Intentions et slots
ml/tts/          Synthèse vocale
data/            Métadonnées et scripts d'accès aux corpus (pas les audios lourds)
eval/            Baseline, mesures WER/CER, intentions, latence
docs/            Cahier des charges et documents de projet
```

## Reproductibilité

Ce dépôt décrit l'architecture, les scripts d'entraînement et d'évaluation, et la façon de relancer les mesures par rapport à une baseline simple.

Pour reproduire les résultats :

1. Cloner ce dépôt.
2. Suivre les instructions de chaque module (`ml/`, `eval/`) pour installer les dépendances.
3. Télécharger les corpus depuis leurs sources officielles (voir ci-dessous) : ils ne sont pas versionnés ici.
4. Lancer les scripts d'évaluation dans `eval/` pour comparer le modèle affiné à la baseline (WER/CER, précision d'intention, F1 des slots, succès de bout en bout, latence).

Les cibles chiffrées du cahier des charges sont des objectifs, pas des résultats déjà mesurés.

## Données et licences

| Source | Langue | Licence | Usage prévu |
| --- | --- | --- | --- |
| [JaimeMaLangue/JML-fon-speech-v1](https://huggingface.co/datasets/JaimeMaLangue/JML-fon-speech-v1) | Fon | CC-BY-SA-4.0 | Corpus principal pour l'ASR fon (attribution et share-alike) |
| [Common Voice Yoruba](https://commonvoice.mozilla.org/) | Yoruba | CC0 | Corpus public pour l'ASR yoruba |

Le projet gouvernemental « J'aime ma langue » annonce un recueil plus large (fon, dendi, bariba, yoruba). À ce jour, seul le corpus fon est publié sur Hugging Face. Le yoruba s'appuie donc sur Common Voice et, le cas échéant, sur des enregistrements de l'équipe.

Les fichiers audio volumineux, les checkpoints et les secrets (`.env`) ne doivent pas être commités. Voir `data/README.md` et `.gitignore`.

Le code de ce dépôt est sous licence MIT (voir `LICENSE`). Les corpus conservent leurs licences d'origine. Les modèles TTS MMS sont CC-BY-NC.

## Équipe

Équipe **KwèGbaTché**, GPU Challenge 2026.
