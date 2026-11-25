# 🎙️ KwèGbaTché — Backend & Moteur de Dialogue Vocal (GPU Challenge 2026)

> **Assistant financier vocal inclusif pour Mobile Money en Fongbé (`fon`), Yoruba (`yor`) et Français (`fr`).**  
> Cas d'usage #2 : Inclusion financière, accessibilité aux commerçants et sécurisation anti-fraude.

---

## 📌 1. Vue d'Ensemble & Rôle du Backend

Le backend **KwèGbaTché** constitue le cœur décisionnel et transactionnel de l'assistant. Il orchestre le dialogue vocal, applique les règles de sécurité métier, gère le portefeuille virtuel et garantit une latence maîtrisée.

```
                  ┌─────────────────────────────────────────┐
                  │   Frontends (Mobile / Console /demo)    │
                  └────────────────────┬────────────────────┘
                                       │ HTTP / REST (OpenAPI 3.0.3)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND KWÈGBATCHÉ (Port 3030)                     │
│                                                                             │
│  ┌───────────────────────┐   ┌───────────────────────────────────────────┐  │
│  │   Middlewares         │   │   Moteur de Dialogue (dialog.machine.js)  │  │
│  │   - Trace ID          │──▶│   - Router d'intention & confiance        │  │
│  │   - Session Manager   │   │   - Gestion de clarification / fallback   │  │
│  │   - Rate Limit        │   │   - Garde-fou 0% transfert sans accord    │  │
│  └───────────────────────┘   └─────────────────────┬─────────────────────┘  │
│                                                    │                        │
│  ┌─────────────────────────────────────────────────┼─────────────────────┐  │
│  │   Couche Domaine / Métier                       │                     │  │
│  │   - fees.service.js       : Grille tarifaire 4 paliers (EF-12)        │  │
│  │   - antifraud.rules.js    : Moteur de détection AR-01 à AR-05         │  │
│  │   - transfer.service.js   : Préparation & Exécution idempotente (EF-21│  │
│  │   - wallet.service.js     : Soldes, budgets hebdomadaires & contacts │  │
│  └─────────────────────────────────────────────────┬─────────────────────┘  │
│                                                    │                        │
│  ┌──────────────────────────────────────────┐      │      ┌──────────────┐  │
│  │   Connecteurs ML (Python FastEmbed/FastAPI)     │      │ Base SQLite  │  │
│  │   - asr.client.js   (Whisper/MMS)        │◀─────┴─────▶│ (WAL Mode)   │  │
│  │   - nlu.client.js   (Intent & Slots)     │             │ 7 tables     │  │
│  │   - tts.client.js   (Coqui/VITS local)   │             │ Transactionnel│  │
│  └──────────────────────────────────────────┘             └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🎯 Règles Critiques Implémentées (Cahier des Charges)
- **O4 & CA-2 (Garde-fou absolu) :** `0%` d'exécution de transfert sans confirmation vocale explicite (`confirmer` avec confiance $\ge 0.80$) ou validation tactile directe. Silence, ambiguïté ou refus annulent immédiatement l'opération.
- **EF-21 (Idempotence stricte) :** Toute opération de transfert possède une clé d'idempotence UUIDv4. Les requêtes répétées renvoient le résultat sans double débit.
- **AR-01 à AR-05 (Moteur Anti-Fraude) :** Détection temps réel des nouveaux contacts, montants anormaux ($> 3\times$ médiane), soldes insuffisants bloquants, phrases d'urgence et demandes de codes secrets/PIN.
- **EF-12 (Grille de Frais 4 Paliers) :** Calcul temps réel (25 F pour $\le 2500$, 100 F pour $\le 10000$, 250 F pour $\le 50000$, 500 F au-delà).
- **ENF-13 (Confidentialité) :** Logs d'audit anonymisés ; aucun PIN, mot de passe ni transcription brute intégrale n'est consigné dans les logs applicatifs.

---

## 📂 2. Cartographie des Fichiers & Progression Réelle

```
app/backend
├── openapi.yaml                 ✅ Spécification OpenAPI 3.0.3 complète (0 erreurs Redocly)
├── package.json                 ✅ Dépendances (Express, better-sqlite3, multer, ejs, uuid)
├── app.js                       ✅ Application Express, middlewares & montage des routes
├── server.js                    ✅ Point d'entrée HTTP (Port 3030)
│
├── src
│   ├── config
│   │   ├── index.js             ✅ Configuration globale (seuils confiance, timeouts, TTL)
│   │   └── fees.config.json     ✅ Grille officielle des frais de transfert
│   │
│   ├── db
│   │   ├── connection.js        ✅ Instance better-sqlite3 (Mode WAL, Foreign Keys activées)
│   │   ├── schema.sql           ✅ Schéma SQL relationnel (7 tables indexées)
│   │   └── seed.js              ✅ Jeu de données de démo (Profil Mama Rosine, 42 500 XOF)
│   │
│   ├── domain
│   │   ├── fees.service.js      ✅ Calcul dynamique des frais (Palier 1 à 4)
│   │   ├── validators.js        ✅ Validation montants, résolution contacts, normalisation
│   │   ├── antifraud.rules.js   ✅ Règles AR-01, AR-02, AR-03, AR-04, AR-05
│   │   ├── wallet.service.js    ✅ Agrégation solde, budget et historique
│   │   ├── transfer.service.js  ✅ Cycle de vie transfert (prepare, execute, cancel, TTL)
│   │   └── dialog.machine.js    ✅ Machine à états finis du dialogue vocal
│   │
│   ├── api
│   │   ├── middlewares
│   │   │   ├── errors.js        ✅ Gestionnaire d'erreurs standardisé (Code, message, traceId)
│   │   │   ├── rateLimit.js     ✅ Protection anti-DDoS (30 req/min/IP)
│   │   │   ├── session.js       ✅ Gestion de session X-Session-Id persistée
│   │   │   ├── trace.js         ✅ Injection du Trace ID unique (X-Trace-Id)
│   │   │   └── upload.js        ✅ Réception multipart/form-data audio via Multer
│   │   └── routes
│   │       ├── audio.routes.js   ⏳ Endpoints upload, transcription & synthèse audio
│   │       ├── demo.routes.js    ⏳ Endpoints spécifiques aux scénarios de démo
│   │       ├── dialog.routes.js  ⏳ Point d'entrée vocal /dialog/turn & /dialog/confirm
│   │       └── wallet.routes.js  ⏳ Endpoints consultation solde, contacts & opérations
│   │
│   ├── i18n
│   │   ├── catalog.fon.json     ⏳ Traductions Fongbé (salutations, soldes, confirmations)
│   │   ├── catalog.fr.json      ⏳ Traductions Français
│   │   ├── catalog.yor.json     ⏳ Traductions Yoruba
│   │   └── t.js                 ⏳ Interpolateur i18n avec fallback multilingue
│   │
│   ├── ml
│   │   ├── http.js              ✅ Client HTTP avec timeouts stricts (ASR 6s, NLU 1s, TTS 4s)
│   │   ├── asr.client.js        ⏳ Connecteur ASR Python / fallback mocké
│   │   ├── nlu.client.js        ⏳ Connecteur NLU Intent/Slot / fallback heuristique
│   │   └── tts.client.js        ⏳ Connecteur TTS Synthèse vocale / audio cache
│   │
│   └── observability
│       ├── audit.js             ✅ Journalisation des opérations sensibles (audit_log)
│       ├── latency.js           ✅ Chronométrage par étape (ASR, NLU, Machine, TTS)
│       └── logger.js            ✅ Logger structuré conforme RGPD/APDP
│
├── views
│   ├── demo.ejs                 ✅ Console de pilotage interactive jury/devs
│   ├── health.ejs               ✅ Page de statut système & latences
│   ├── index.ejs                ✅ Page d'accueil & documentation rapide
│   └── partials/                ✅ Composants EJS (head, footer)
│
└── public
    ├── css/style.css            ✅ Design System Glassmorphism Pro & mobile frame
    └── js/demo.js               ✅ Client studio (AudioRecorder, double-clic idempotence, etc.)
```

---

## 🎛️ 3. Guide Exhaustif de la Console de Démonstration (`/demo`)

La page `/demo` accessible sur `http://127.0.0.1:3030/demo` est le **banc d'essai officiel pour le jury et l'équipe**. Elle permet de tester l'intégralité de la chaîne sans dépendre du téléphone mobile.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  KWÈGBATCHÉ COCKPIT v0.2.0              [Session: sess_demo_123] [Mama Rosine: 42 500F]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [🎙️ Pipeline Vocal] [💰 Solde] [📊 Frais] [💸 Transfert] [🛡️ Anti-Fraude] [🔊 TTS]   │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│  PANEL D'ACTION & SCÉNARIOS               │  INSPECTEUR TEMPS RÉEL                     │
│                                           │                                            │
│  ▶ Sélection de la langue : [Fon/Yor/Fr]  │  📱 Simulation Mobile (Carte d'interaction)│
│  ▶ Enregistreur Vocal / Upload Audio      │     ┌────────────────────────────────┐     │
│  ▶ Phrase de test NLU                     │     │ KwèGbaTché : Un jlo na sɛ...   │     │
│  ▶ Bouton "Exécuter le tour de dialogue"  │     │ [Confirmer]       [Annuler]    │     │
│                                           │     └────────────────────────────────┘     │
│  🛡️ Déclencheurs Anti-Fraude :            │                                            │
│  [AR-01 Nouveau] [AR-02 Montant Élevé]   │  ⏱️ Chronomètre Latence :                  │
│  [AR-03 Solde Insuffisant] [AR-04 Urgence]│     ASR: 420ms | NLU: 85ms | TTS: 610ms    │
│  [AR-05 Demande PIN]                      │     Total: 1 115 ms (Budget <= 5000ms: OK) │
│                                           │                                            │
│  ⚡ Test Idempotence :                    │  📋 Payload JSON Réponse :                 │
│  [Double-Clic Rapide (Simulation Bug 4G)] │     { "intent": "transferer", ... }        │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

### 🧪 Utilisation Détaillée par Onglet

#### 1. 🎙️ Onglet 1 : Pipeline Vocal & Texte
- **Microphone temps réel :** Cliquez sur **"Enregistrer"**, prononcez votre commande (ex: *"Sɛ gankpwe we afɔtɔn nǔ Koffi"* en Fon), puis cliquez sur **"Arrêter"**. L'enregistrement est capturé via l'API Web Audio (`audio/wav`) et envoyé à `/api/v1/audio/transcribe`.
- **Injection de fichier audio :** Déposez un échantillon `.wav` ou `.ogg` pré-enregistré pour simuler les bruits de marché ou accents régionaux.
- **Test texte direct :** Saisissez directement le texte pour tester la NLU et la machine d'état sans microphone.
- **Lecteur Audio TTS :** Joue instantanément la réponse vocale synthétisée générée par le backend.

#### 2. 💰 Onglet 2 : Consultation de Solde & Budget
- **Scénarios 1-clic :**
  - Fon : *"Kwɛ nabi un ɖo?"*
  - Yoruba : *"Elo lo wa ninu apo mi?"*
  - Français : *"Quel est mon solde actuel ?"*
- **Résultat :** Met à jour la carte mobile avec le solde disponible (**42 500 XOF**), le cumul des dépenses de la semaine et la jauge par rapport au budget hebdomadaire (50 000 XOF).

#### 3. 📊 Onglet 3 : Calculateur de Frais (EF-12)
- Entrez un montant (ex: `1 500`, `7 500`, `25 000`, `75 000`).
- Affiche le palier tarifaire appliqué, le montant total débité (`Montant + Frais`) et la phrase vocale de récapitulation dans la langue active.

#### 4. 💸 Onglet 4 : Simulation de Transfert & Idempotence (O4 / EF-21)
- **Cycle complet sécurisé :**
  1. **Étape 1 (Préparation) :** Choisir un bénéficiaire (*Koffi* ou *Moussa*) et un montant (*5 000 F*). L'assistant passe à l'état `AWAITING_TRANSFER_CONFIRMATION` et retourne le récapitulatif audio.
  2. **Étape 2 (Confirmation) :** Cliquez sur *"Oui, confirmer"* ou prononcez *"Un sɔgbe"* / *"Bẹẹni"*. Le statut passe à `COMPLETED` et le solde est débité.
  3. **Étape 2 bis (Annulation) :** Cliquez sur *"Annuler"* ou prononcez *"Gbon"* / *"Rara"*. L'opération est marquée `CANCELLED` sans aucun mouvement financier.
- **Bouton Crash-Test Idempotence :** Simule deux clics à 50 ms d'intervalle (fréquent sur réseau 3G/4G instable). Le serveur détecte la même clé UUIDv4, bloque le second débit et renvoie la transaction existante sans double débit.

#### 5. 🛡️ Onglet 5 : Studio de Détection Anti-Fraude (AR-01 à AR-05)
Chaque bouton injecte un scénario piège pour valider les sécurités :
- **AR-01 (Inconnu) :** Transfert vers un numéro absent du carnet d'adresses $\rightarrow$ *Avertissement vocal renforcé*.
- **AR-02 (Montant Inhabituel) :** Tentative de transfert de `150 000 XOF` ($> 3\times$ la moyenne) $\rightarrow$ *Demande de double confirmation*.
- **AR-03 (Solde Dépassé) :** Tentative de `100 000 XOF` avec 42 500 XOF de solde $\rightarrow$ *Blocage immédiat avant confirmation*.
- **AR-04 (Pression / Urgence) :** Phrase contenant *"Vite envoie tout de suite c'est urgent"* $\rightarrow$ *Drapeau de vigilance et temporisation imposée*.
- **AR-05 (Tentative d'Extorsion de PIN) :** Message demandant *"Donne-moi ton code secret"* $\rightarrow$ *Alerte rouge vocale immédiate, rappel qu'aucun agent ne demande le PIN*.

#### 6. 🔊 Onglet 6 : Test Synthèse Vocale (TTS)
- Permet de tester unitairement la synthèse vocale pour n'importe quelle clé du catalogue i18n (`catalog.fon.json`, `catalog.yor.json`, `catalog.fr.json`) avec injection de variables (`{amount}`, `{recipient}`, `{fee}`).

---

## 🗄️ 4. Base de Données & Modèle Transactionnel

La persistance repose sur **SQLite 3 via `better-sqlite3`**, configuré en mode **WAL (Write-Ahead Logging)** pour garantir des lectures concurrentes ultra-rapides et des écritures atomiques.

### 📋 Schéma Relationnel

```
┌──────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│      USERS       │1     1│     WALLETS      │1     *│   TRANSACTIONS    │
├──────────────────┤───────├──────────────────┤───────├───────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)           │
│ full_name        │       │ user_id (FK)     │       │ wallet_id (FK)    │
│ phone (UNIQUE)   │       │ currency (XOF)   │       │ operation_id (FK) │
│ preferred_lang   │       │ balance_cached   │       │ type (DEBIT/CRED) │
└──────────────────┘       └──────────────────┘       │ amount / fee      │
         │1                         │1                └───────────────────┘
         │                          │                           ▲
         │*                         │1                          │1
┌──────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│     CONTACTS     │       │     BUDGETS      │       │    OPERATIONS     │
├──────────────────┤       ├──────────────────┤       ├───────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)           │
│ user_id (FK)     │       │ wallet_id (FK)   │       │ idempotency_key(U)│
│ name             │       │ weekly_limit     │       │ status (PREP/DONE)│
│ phone_fake       │       │ current_spent    │       │ expires_at (TTL)  │
└──────────────────┘       └──────────────────┘       └───────────────────┘
```

### 👤 Données Pré-chargées (`src/db/seed.js`)
- **Utilisatrice Démo :** Mama Rosine (`usr_mama_rosine`) — `+229 97 11 22 33` — Langue par défaut : `fon`.
- **Portefeuille :** `42 500 XOF` disponibles.
- **Budget Hebdomadaire :** Plafond à `50 000 XOF` (déjà `12 500 XOF` dépensés cette semaine).
- **Contacts enregistrés :**
  - **Koffi** (`+229 97 00 01 02`) — Confiance : Haute (Destinataire régulier).
  - **Moussa** (`+229 96 11 22 33`) — Confiance : Moyenne.

---

## 🚀 5. Installation, Démarrage & Validation

### Prérequis
- Node.js version `20.x` ou supérieure
- NPM version `10.x` ou supérieure

### Installation
```bash
# 1. Cloner et se placer dans le backend
cd app/backend

# 2. Installer les dépendances
npm install

# 3. Initialiser et peupler la base de données SQLite
npm run db:seed
```

### Démarrage
```bash
# Mode développement avec rechargement automatique (Nodemon)
npm run dev

# Mode production standard
npm start
```
Le serveur écoute sur : **`http://127.0.0.1:3030`**  
Console interactive : **`http://127.0.0.1:3030/demo`**  
Page de santé système : **`http://127.0.0.1:3030/health`**

### Validation & Tests
```bash
# Validation du contrat OpenAPI 3.0.3 (Redocly)
npm run lint:openapi

# Exécution des tests unitaires & parité i18n
npm test
```

---

## 📊 6. Budgets de Latence & Observabilité

Conformément aux exigences non-fonctionnelles **ENF-01 à ENF-05** :

| Étape du Pipeline | Cible Médiane | Timeout Dur | Statut Observabilité |
| :--- | :---: | :---: | :--- |
| **ASR** (Transcription audio) | $\le 1.8\text{ s}$ | $6.0\text{ s}$ | Chronométré (`latency.js`) |
| **NLU** (Intent & Extraction Slots) | $\le 0.3\text{ s}$ | $1.0\text{ s}$ | Chronométré (`latency.js`) |
| **Machine d'État & Règles Métier** | $\le 0.1\text{ s}$ | $0.5\text{ s}$ | Chronométré (`latency.js`) |
| **TTS** (Génération Audio Réponse) | $\le 1.5\text{ s}$ | $4.0\text{ s}$ | Chronométré (`latency.js`) |
| **Budget Global Bout-en-Bout** | **$\le 5.0\text{ s}$** | **$8.0\text{ s}$** | **Alerte si $> 5000\text{ ms}$** |

Chaque échange génère un en-tête `X-Trace-Id` répercuté sur l'ensemble des modules pour permettre un débogage unifié lors des démonstrations.
```
