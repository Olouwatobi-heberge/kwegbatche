**GPU Challenge 2026 – Fintech Academia & Next Fintech Forum 2026** 

Epitech Bénin 

# **CAHIER DES CHARGES** 

## **KwèGbaTché** 

_Assistant financier vocal en fon, yoruba et français pour les utilisateurs béninois du mobile money_ 

Thème : « Construisez l'IA qui transforme la finance africaine » 

Cas d'usage officiel n° 2 : comprendre ses frais, consulter un budget ou préparer un transfert en parlant dans une langue locale 

|**Élément**|**Valeur**|
|---|---|
|Projet|KwèGbaTché –prototype(MVP)d'assistant vocal connecté à unportefeuille fictif|
|Équipe|KwèGbaTché(équipe sélectionnée)– 4 membres|
|Partenaires de l'événement|Alliance Fintech UEMOA,PayFonte,UDU Technologies,Kernel|
|Version / date|v1.0 – samedi 21 novembre 2026|
|Échéance des livrables<br>ii|mardi 24 novembre 2026,23h59(objectif interne : soumission avant 21h00)|
|Demi-finale / finale|mercredi 25 novembre(pitch + démo)/jeudi 26 novembre 2026|
|Statut|Document de cadrage interne –prototype de hackathon(aucune transaction réelle)|



Équipe : Amos BYLL-CATARIA · Merveille GOMEZ · Andy KOUMAGNON · Lovia KOUNOUHO 

### **Sommaire** 

1. Contexte et problème 

2. Objectifs 

3. Utilisateurs cibles et persona 

4. Périmètre du prototype 

5. Exigences fonctionnelles et parcours des scénarios 

6. Exigences non fonctionnelles 

7. Architecture technique 

8. Données et conformité 

9. Plan d'évaluation et critères d'acceptation 

10. Organisation, rôles (RACI) et planning 

11. Livrables 

12. Risques et mitigations 

13. Perspectives : pilote avec les fintechs partenaires 

Annexe A – Exemples de phrases en français à traduire 

- Annexe B – Glossaire 

**Convention du document.** Tous les objectifs chiffrés figurant dans ce cahier des charges sont des **cibles** que l'équipe se fixe pour le prototype ; ils ne constituent pas des résultats mesurés. Les résultats réels seront mesurés sur le jeu de test et publiés, avec leurs limites, dans le rapport d'évaluation livré le 24 novembre. 

#### **Historique des versions** 

|**Version**|**Date**|**Modifications**|
|---|---|---|
|v1.0|21/11/2026|Version initiale soumise à la validation de l'équipe.|



### **1. Contexte et problème** 

#### **1.1 Contexte** 

Le GPU Challenge 2026, organisé dans le cadre de Fintech Academia et du Next Fintech Forum 2026 à Epitech Bénin, avec l'Alliance Fintech UEMOA, PayFonte, UDU Technologies et Kernel, invite les équipes à « construire l'IA qui transforme la finance africaine ». L'équipe KwèGbaTché traite le **cas d'usage officiel n° 2** : permettre à un utilisateur de comprendre ses frais, consulter un budget ou préparer un transfert en parlant dans une langue locale. Le prototype attendu par l'organisation est **un assistant vocal français–langue locale, connecté à un portefeuille fictif, avec confirmation avant toute opération** . 

#### **1.2 Problème adressé** 

Au Bénin, le mobile money est devenu un outil quotidien, y compris pour des personnes peu à l'aise avec l'écrit. Les interfaces actuelles (menus USSD, applications, SMS de confirmation) reposent largement sur la lecture du français. Pour ces utilisateurs, cela se traduit par : 

- une **dépendance à des tiers lettrés** (enfants, voisins, agents) pour consulter un solde ou envoyer de l'argent, avec un risque d'abus de confiance ; 

- des **erreurs de saisie** (montant, numéro du destinataire) difficiles à détecter et à corriger ; 

- une **mauvaise compréhension des frais** prélevés sur une opération ; 

- une **exposition aux arnaques** (faux messages de transfert reçu, faux agents, demandes de code) qu'il est difficile d'identifier sans lire. 

#### **1.3 Réponse proposée** 

KwèGbaTché est un assistant vocal qui permet de dialoguer **en fon, en yoruba ou en français** avec son portefeuille mobile money : l'utilisateur parle, l'assistant comprend l'intention, répond à voix haute et **demande systématiquement une confirmation vocale avant toute opération** . Une détection d'arnaques simple (alertes sur les transferts suspects et sur des messages typiques de fraude) vient en complément, sans être au cœur du prototype. 

KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 2 

### **2. Objectifs** 

#### **2.1 Objectif général** 

Démontrer, sous forme d'un prototype fonctionnel en 3 jours, qu'un assistant vocal en langues locales peut rendre les opérations courantes du mobile money **compréhensibles, autonomes et sûres** pour un utilisateur peu à l'aise avec l'écrit, en s'appuyant sur des modèles de parole affinés sur GPU et évalués de façon reproductible. 

#### **2.2 Objectifs spécifiques** 

|**N°**|**Objectif**|**Indicateur**|**Cible (non mesurée à ce jour)**|
|---|---|---|---|
|O1|Réaliser les 3 scénarios de bout en bout à la<br>voix(frais,solde/budget,transfert)|Taux de succès de bout en bout sur le jeu<br>de scénarios de test|≥ 80 % en français ; ≥ 60 % en fon et en<br>yoruba|
|O2|Améliorer la reconnaissance vocale par<br>rapport à la baseline|WER/CER par langue, modèle affiné vs<br>MMS sans fine-tuning|Réduction relative du WER d'au moins<br>15 % en fon sur le domaine financier|
|O3|Comprendre l'intention et extraire montant<br>et destinataire|Précision des intentions ; F1 des entités|Précision ≥ 85 % ; F1 ≥ 0,80|
|O4|Garantir la sécurité des opérations|Part des transferts exécutés sans<br>confirmation explicite|0 % (exigence stricte, non négociable)|
|O5|Offrir une interaction fluide|Latence médiane d'un tour de parole (fin<br>deparole → début de réponse audio)|≤ 5 s sur GPU|
|O6|Assurer la reproductibilité|Résultats régénérables par un tiers à<br>partir du dépôt|Scripts, seed fixée, README, jeu de test<br>figé|



_Les cibles O1 à O3 et O5 seront ajustées si la baseline se révèle très éloignée ; tout écart sera documenté dans le rapport d'évaluation plutôt que masqué._ 

### **3. Utilisateurs cibles et persona** 

#### **3.1 Utilisateurs cibles** 

- **Cible principale** : adultes béninois utilisant le mobile money, locuteurs du fon ou du yoruba, peu à l'aise avec la lecture et l'écriture du français (commerçants, artisans, agriculteurs, personnes âgées). 

- **Cible secondaire** : utilisateurs francophones souhaitant une interaction vocale rapide, et agents ou proches qui accompagnent ces utilisateurs. 

- **Clients B2B potentiels** : fintechs, opérateurs et agrégateurs de paiement souhaitant élargir l'inclusion financière (voir section 13). 

#### **3.2 Persona : Mama Rosine** 

|**Dimension**|**Description**|
|---|---|
|Profil|Commerçante sur un marché, parle couramment le fon, comprend un peu le français oral, lit très<br>difficilement.|
|Usage actuel|fi<br>Reçoit des paiements de clients et envoie de l'argent à sa famille et à ses fournisseurs via mobile<br>money.|
|Difficultés|Dépend de personnes lettrées pour vérifier son solde ou faire un transfert ; ne sait pas vérifier les<br>fraisprélevés;a déjà subi des erreurs de montant et des abus de lapart d'intermédiaires.|
|Risques|Cible privilégiée des messages frauduleux (« vous avez reçu un transfert par erreur, renvoyez-le<br>»)et des demandes de code secret.|
|Attentes|Parler dans sa langue, entendre une réponse claire, garder le contrôle (rien ne part sans son « oui<br>»),être avertie en cas de situation suspecte.|
|Contexte technique|Smartphone d'entrée de gamme, connexion mobile parfois instable, environnement bruyant<br>(marché).|



### **4. Périmètre du prototype** 

|**Dans le périmètre (MVP)**|**Hors périmètre**|
|---|---|
|Application web avec capture micro et restitution audio<br>ii|Transactions réelles et mouvements d'argent<br>i|
|Portefeuille fictif en base locale (solde, historique, budget,<br>contacts)<br>i|Intégration réelle avec les opérateurs mobile money ou des<br>API depaiement<br>iii|
|Scénario 1 : comprendre les frais d'une opération (grille de<br>frais fictiveparamétrable)|KYC, ouverture de compte, authentification forte réelle|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 3 

|**Dans le périmètre (MVP)**|**Hors périmètre**|
|---|---|
|Scénario 2 : consulter le solde et le budget<br>ii|Application mobile native,canal USSD ou appel téléphonique|
|Scénario 3 : préparer un transfert avec confirmation vocale<br>obligatoire avant exécution(fictive)|Autres langues que le fon, le yoruba et le français<br>i    i|
|Langues : fon, yoruba, français (reconnaissance et synthèse)<br>i|Détection de fraude par apprentissage sur données réelles<br>de transactions|
|Détection d'arnaques simple par règles (alertes)<br>ii|Conformité réglementaire complète (agrément, audit<br>sécurité)|
|Évaluation comparée à une baseline,scripts reproductibles|Passage à l'échelle,haute disponibilité|



_La grille de frais utilisée est_ **_fictive et paramétrable_** _; elle ne prétend pas refléter les tarifs d'un opérateur réel. Elle pourra être remplacée par une grille officielle lors d'un pilote._ 

### **5. Exigences fonctionnelles et parcours des scénarios** 

#### **5.1 Exigences fonctionnelles** 

Priorités MoSCoW : **M** = Must (indispensable à la démo), **S** = Should (important), **C** = Could (si le temps le permet), **W** = Won't (pas dans ce prototype). 

|**ID**|**Exigence**|**Priorité**|
|---|---|---|
|EF-01|L'utilisateur choisit sa langue(fon, yoruba,français) ;le choix est mémorisépour la session.<br>i|M|
|EF-02|L'utilisateur enregistre sa demandepar un bouton micro unique et large(appuyerpourparler).|M|
|EF-03|Le système transcrit la parole avec le modèle ASR adapté à la langue (MMS pour le fon et le yoruba, Whisper pour<br>le français et en alternativepour leyoruba).|M|
|EF-04|Le système identifie l'intention parmi : demander_frais, consulter_solde, consulter_budget, preparer_transfert,<br>confirmer,annuler,aide,hors_domaine.|M|
|EF-05|Le système extrait les entités montant (en francs CFA, y compris exprimé en toutes lettres) et destinataire (nom<br>présent dans les contacts).|M|
|EF-06|Le système calcule et annonce les frais d'une opération àpartir de lagrille fictive,avec le montant total débité.|M|
|EF-07|Le système annonce le solde et,sur demande,les dépenses de lapériode et le budget restant.|M|
|EF-08|Le système prépare un transfert, récapitule à voix haute (destinataire, montant, frais, total) et attend une<br>confirmation explicite.|M|
|EF-09|Aucune opération n'est exécutée sans confirmation vocale explicite ; un silence, un refus ou une réponse ambiguë<br>annule l'opération.|M|
|EF-10|Le système répond à voix haute (TTS) dans la langue choisie et affiche un résumé visuel simple (pictogrammes,<br>montants engrands chiffres).|M|
|EF-11|Repli sur incertitude : sous le seuil de confiance, le système reformule ce qu'il a compris et demande de répéter,<br>puis bascule vers des boutons / le clavier(voir 5.6).|M|
|EF-12|Le module anti-arnaque applique les règles AR-01 à AR-05 (5.7) et émet une alerte vocale avant la confirmation<br>d'un transfert suspect.|S|
|EF-13|L'utilisateur peut faire analyser un message reçu (texte collé ou lu à voix haute) ; le système signale urgence et<br>demande de code(AR-04,AR-05).<br>iiiii|C|
|EF-14|Le système conserve un historique fictif des opérations et unjournal d'audit local(confirmations,refus,alertes).<br>iiii|S|
|EF-15|Un mode démonstrationpermet de réinitialiser leportefeuille fictif à un état de référence.|S|
|EF-16|Boutons et clavier de secours (montant, contacts, Oui/Non) disponibles à tout moment et imposés après deux<br>échecs de compréhension ou si le micro est indisponible.|S|
|EF-19|L'utilisateur peut changer de langue à tout moment (bouton ou commande vocale) sans perdre l'opération en<br>cours;tous les messages existent dans les 3 langues.|M|
|EF-20|L'utilisateur peut annuler à tout moment (« annule », « non », bouton rouge) ; l'opération en cours est<br>abandonnée sans effet sur le solde.|M|
|EF-21|Chaque transfert porte une clé d'idempotence unique : une double confirmation, un double clic ou un renvoi<br>réseau n'exécutejamais deux fois l'opération.|M|
|EF-17|Authentificationpar code PIN vocal ou biométrie vocale.<br>i|W|
|EF-18|Exécution de transferts réels via une API d'opérateur.|W|



#### **5.2 Parcours du scénario 1 – Comprendre les frais** 

- L'utilisateur : « Combien je paie si j'envoie 10 000 francs ? » 

- ASR → texte ; NLU → intention demander_frais, montant = 10 000. 

- Le backend consulte la grille fictive et calcule frais et total. 

- Réponse vocale : montant envoyé, frais, total débité, avec rappel que la grille est indicative. 

- Critère de réussite : intention et montant corrects, frais conformes à la grille, réponse audio intelligible dans la langue choisie. 

KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 4 

#### **5.3 Parcours du scénario 2 – Consulter solde et budget** 

- L'utilisateur : « Combien il me reste ? » puis « Combien j'ai dépensé cette semaine ? » 

- NLU → consulter_solde, puis consulter_budget (période = semaine). 

- Le backend lit le portefeuille fictif (solde, historique, budget défini). 

- Réponse vocale : solde ; total des dépenses de la période ; budget restant et alerte douce si le budget est dépassé. 

- Critère de réussite : valeurs annoncées identiques à celles de la base fictive. 

#### **5.4 Parcours du scénario 3 – Préparer un transfert avec confirmation** 

|**Étape**|**Acteur**|**Action**|
|---|---|---|
|1|Utilisateur|« Envoie 5 000 francs à Koffi. »|
|2|Système|NLU → preparer_transfert ; montant = 5 000 ; destinataire = Koffi (recherche dans les contacts fictifs ; si<br>plusieurs Koffi,demande deprécision).|
|3|Système|Contrôles : solde suffisant ; module anti-arnaque (nouveau destinataire, montant inhabituel). Si alerte :<br>message d'avertissement vocal.|
|4|Système|Récapitulatif vocal et visuel : « Vous allez envoyer 5 000 F à Koffi. Frais : X F. Total : Y F. Dites OUI pour<br>confirmer ou NONpour annuler. »|
|5|Utilisateur|Répond « oui » / « non »(ou équivalent en fon /yoruba).|
|6|i<br>Système|Si « oui » reconnu avec confiance suffisante : exécution fictive, mise à jour du solde, confirmation vocale.<br>Sinon : annulation et message « opération annulée ».|
|7|Système|ii<br>Écriture dans lejournal d'audit(horodatage,décision,alertes).|



Critère de réussite : le transfert n'est exécuté **que** après un « oui » explicite ; tout autre cas (silence, « non », réponse ambiguë, délai dépassé) conduit à l'annulation. 

#### **5.5 Règles du transfert et idempotence** 

- **Récapitulatif vocal et visuel** obligatoire (destinataire, montant, frais, total) ; **confirmation explicite** (« oui » reconnu avec une confiance ≥ seuil, ou bouton Oui) ; **annulation à tout moment** jusqu'à l'exécution. 

- **Jamais d'exécution sous le seuil de confiance** (ASR ou intention) : le système redemande, puis propose les boutons ; un « oui » incertain vaut refus. 

- **Idempotence** : à la préparation, le backend crée une opération avec une clé unique (UUID) et l'état « en attente ». L'exécution est une transition atomique « en attente → exécutée » conditionnée à cette clé ; toute nouvelle confirmation ou requête rejouée avec la même clé renvoie le résultat déjà enregistré, sans nouveau débit. 

- Expiration de l'opération en attente après 30 s sans confirmation (cible) : statut « expirée », rien n'est débité. 

#### **5.6 Repli sur incertitude et « je n'ai pas compris »** 

|**Situation**|**Comportement spécifié**|
|---|---|
|Confiance ≥ seuil haut (cible initiale 0,80, calibrée<br>sur lejeu de validation)|Le système poursuit ; pour un transfert, le récapitulatif reste obligatoire.|
|Confiance entre seuil bas (cible 0,50) et seuil haut|Reformulation : « Vous voulez envoyer 5 000 F à Koffi, c'est bien ça ? » (réponse<br>Oui/Non).|
|Confiance < seuil bas, ou intention hors_domaine<br>(1er échec)|Message « je n'ai pas compris » dans la langue courante, avec un exemple de phrase<br>et invitation à répéter.|
|2e échec consécutif|Bascule vers boutons pictogrammes (Frais / Solde / Envoyer) et clavier numérique<br>pour le montant;la voix reste utilisable.|
|Silence > 8 s ou micro indisponible|Invite vocale courte, puis affichage des boutons;aucune action financière.|



#### **5.7 Règles anti-arnaque testables** 

|**Règle**|**Déclencheur (paramétrable)**|**Réaction**|
|---|---|---|
|AR-01 Nouveau<br>destinataire|Destinataire absent de l'historique de transferts<br>i|Alerte vocale + double récapitulatif<br>ii|
|AR-02 Montant inhabituel|Montant > 3 × la médiane des transferts de l'utilisateur, ou ><br>plafond démo|Alerte vocale ; confirmation renforcée<br>(montant répétépar l'utilisateur)<br>i|
|AR-03 Dépassement|Total(montant + frais)> solde|Refus expliqué,aucune opération créée<br>i|
|AR-04 Urgence|Mots-clés d'urgence dans la demande ou le message analysé<br>(« vite »,« tout de suite »,«par erreur,renvoyez »)|Alerte vocale « prenez le temps de vérifier »|
|AR-05 Demande de code|Message demandant un code secret / PIN / code de<br>validation|Alerte forte : « ne donnez jamais votre code<br>»|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 5 

_Chaque règle dispose d'au moins un test positif et un test négatif automatisés ; les seuils sont des paramètres de démonstration, non des valeurs calibrées sur des fraudes réelles._ 

#### **5.8 Langues et parité des messages** 

- Les messages du système sont stockés dans un catalogue unique (clé → fon / yoruba / français) ; aucun texte n'est codé en dur. 

- **Test automatique de parité** en CI : chaque clé existe dans les 3 langues, non vide, avec les mêmes variables ({montant}, {destinataire}) ; une clé manquante fait échouer la CI. 

- Le changement de langue conserve l'état du dialogue ; le récapitulatif est relu dans la nouvelle langue avant toute confirmation. 

### **6. Exigences non fonctionnelles** 

|**ID**|**Catégorie**|**Exigence**|
|---|---|---|
|ENF-01|Sécurité – confirmation|Machine à états côté serveur : l'état « exécuter » n'est atteignable que depuis « en attente de<br>confirmation » après une intention confirmer explicite. Délai d'expiration de la confirmation<br>(cible : 30 s).|
|ENF-02|Sécurité – données|Aucune donnée bancaire réelle ; portefeuille et contacts fictifs ;**aucun vrai numéro de**<br>**téléphone** (numéros factices au format non attribuable).|
|ENF-03|Confidentialité – voix|La voix est une donnée personnelle sensible : consentement écrit, finalité limitée au hackathon,<br>identifiants de locuteurs pseudonymisés, métadonnées sans nom ; audios de démo supprimés<br>en fin de session ; corpus de l'équipe conservé jusqu'au 31/12/2026 puis supprimé sauf accord<br>de prolongation ; droit de retrait. Traitement local ; si une API tierce était utilisée, elle serait<br>signalée dans l'interface et le README.|
|ENF-04|Latence|Cible de bout en bout sur GPU : médiane ≤ 5 s et**p95 ≤ 8 s**, décomposée et mesurée par étape<br>(tableau 6.1).|
|ENF-05|Faible connexion / mode<br>dégradé|Inférence sur serveur local (aucune API cloud). Audio compressé (Opus) avant envoi. Tests sous<br>réseau bridé type 3G et sur téléphone d'entrée de gamme. Mode dégradé : réponses TTS<br>fréquentespré-générées,réponse texte si TTS indisponible,boutons si ASR indisponible.|
|ENF-11|Timeouts et retry|Timeout par appel (ASR 6 s, NLU 1 s, TTS 4 s – cibles) ; un seul retry automatique sur les<br>opérations de lecture ; les requêtes d'exécution sont rejouables sans doublon grâce à la clé<br>d'idempotence(EF-21).|
|ENF-12|Sécurité – dépôt|Aucun secret dans le dépôt : fichier .env.example, .env ignoré par git, détection de secrets en CI<br>(ex.gitleaks).|
|ENF-13|Sécurité – journaux|Logs JSON structurés avec trace_id par requête, sans donnée personnelle (ni audio, ni<br>transcription complète,ni numéro) ;duréespar étapepour la mesure de latence.|
|ENF-14|Sécurité –<br>authentification|La voix seule n'authentifie pas : l'exécution exige la confirmation explicite et, dans la démo, un<br>PIN fictif à 4 chiffres saisi au clavierpour les montants au-dessus d'unplafond.|
|ENF-15|Sécurité – entrées|Limitation de débit par session (ex. 30 requêtes/min) ; validation stricte côté serveur : montant<br>entier borné (1 à 500 000 F en démo), destinataire existant, taille et durée d'audio bornées (≤ 15<br>s).|
|ENF-06|Accessibilité|Interface utilisable sans lire : un seul bouton micro large, pictogrammes, codes couleur (vert =<br>confirmé,rouge = annulé/alerte),montants engrands chiffres,réécoute de la dernière réponse.|
|ENF-07|Robustesse|if<br>Gestion du bruit de fond (normalisation, détection d'activité vocale) ; message clair en cas<br>d'échec etpossibilité de répéter.|
|ENF-08|Reproductibilité|Voir 9.5 : seeds,versions figées,hash du dataset,Docker Compose,commande make eval.|
|ENF-09|Traçabilité|Journal d'audit local des décisions (confirmation, refus, alerte) pour l'analyse et la<br>démonstration.|
|ENF-10|Maintenabilité|Services séparés(ASR,NLU,TTS, portefeuille)exposéspar API,remplaçables indépendamment.|



#### **6.1 Budget de latence (cibles, à mesurer)** 

|**Étape**|**Médiane cible**|**p95 cible**|**Mesure**|
|---|---|---|---|
|Capture + envoi audio(réseau 3G bridé)|0,8 s|2,0 s|horodatage navigateur → serveur|
|ASR(MMS / Whisper,GPU)<br>i|2,0 s|3,5 s|durée service ASR|
|NLU(règles +petit modèle)<br>i|0,2 s|0,5 s|durée service NLU|
|Orchestration +portefeuille|0,3 s|0,3 s|durée backend|
|TTS(ou audiopré-généré)|1,5 s|1,7 s|durée service TTS|
|**Total d'un tour**|**≤ 5 s**|**≤ 8 s**|trace_id de bout en bout|



### **7. Architecture technique** 

L'architecture repose sur une application web légère, un backend Node.js qui orchestre le dialogue, et des services Python d'IA (ASR, NLU, TTS) exécutés sur GPU. Le portefeuille fictif est stocké dans une base locale. 

KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 6 



<!-- Start of picture text -->
Architecture du prototype KwéGbaTché<br>eudio Service ASR (Python)<br>Application web audio MMS-1B-all (fon, yoruba)<br>(navigateur) , Whisper (francais, yoruba)<br>Micro + haut-parleur Backend Node.js<br>Ecran simplifié API REST<br>+<br>orchestrateur wore Service NLU<br>de dialogue Intentions (régles + petit modéle)<br>(machine a états) Entités : montant, destinataire<br>Module anti-arnaque Confirmation<br>Regles : montant transfert obligatoire<br>sh nouveau avant exécution texte réponse, Service TTS<br>coe mots-clés mms-tts-fon / mms-tts-yor<br>Owens (+ voix francaise)<br>Portefeuille fictif éeritare :<br>Base locale (SQLite) Journal d'audit local<br>solde, budget, historique (confirmations, alertes, refus)<br><!-- End of picture text -->

_Figure 1 – Schéma d'architecture simplifié_ 

|**Composant**|**Technologie**|**Rôle**|
|---|---|---|
|Front web|HTML/JS(framework léger),API MediaRecorder|Capture audio,lecture des réponses,affichage simplifié<br>i|
|Backend|Node.js (JavaScript), API REST|Sessions, machine à états du dialogue, règles métier,<br>appels aux services<br>i  i|
|ASR|facebook/mms-1b-all avec adaptateurs fon et yoruba ;<br>Whisper pour le français et le yoruba (Whisper ne<br>prendpas en charge le fon)<br>i|Transcription ; fine-tuning sur GPU des adaptateurs sur<br>le domaine financier<br>i  i  i|
|NLU|Règles (mots-clés, expressions de montants) + petit<br>classifieur entraîné sur lesphrases scriptées|Intention + entités (montant, destinataire)|
|TTS<br>ii|facebook/mms-tts-fon, facebook/mms-tts-yor ; voix<br>française libre|Réponse vocale<br>ii|
|Portefeuille fictif<br>i|SQLite(base locale)|Solde,historique,budget,contacts, grille de frais fictive|
|Anti-arnaque|Règlesparamétrables|Alertes sur transferts et messages suspects<br>i|
|Entraînement /<br>évaluation|Python, PyTorch, Hugging Face Transformers/Datasets,<br>scripts de métriques(WER/CER)|Fine-tuning, baseline, rapport reproductible|



**Choix de routage ASR** : français → Whisper ; fon → MMS (adaptateur affiné) ; yoruba → MMS et Whisper comparés sur le jeu de test, le meilleur étant retenu pour la démo. 

### **8. Données et conformité** 

#### **8.1 Sources de données** 

|**Source**|**Langue**|**Contenu (selon la documentation de la**|**Licence / obligations**|
|---|---|---|---|
|||**source)**||
|Corpus national « J'aime ma langue<br>» (MTDI, ASIN, IIDiA) – dataset<br>Hugging Face JaimeMaLangue/JML-<br>fon-speech-v1|Fon|Entre 100 K et 1 M d'enregistrements, WAV<br>16 kHz, transcriptions tonales validées +<br>partie non transcrite|CC-BY-SA-4.0 : attribution<br>obligatoire, partage à l'identique des<br>données dérivées|
|FFSTC-2|Fon–français|Environ 61 h de parole fon alignée avec du<br>français|Licence à vérifier et citer avant<br>usage|
|Corpus Fongbe(Laleye)– Zenodo|Fon|Corpus deparole fon|CC-BY-4.0 : attribution|
|Common Voice –yoruba|Yoruba|Environ 6 h validées|CC0(domainepublic)|
|Enregistrements de l'équipe|Fon, yoruba,<br>français|Phrases financières scriptées : frais, solde,<br>budget,transfert,montants,noms|Propriété de l'équipe ;<br>consentement écrit des locuteurs|



Le projet « J'aime ma langue » annonce également du yoruba, mais aucune donnée yoruba n'est publiée à ce jour : le yoruba repose donc sur Common Voice et sur les enregistrements de l'équipe. 

KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 7 

#### **8.2 Protocole de collecte des enregistrements propres** 

- Script de phrases rédigé en français (annexe A), traduit en fon et en yoruba par des locuteurs natifs et relu. 

- Enregistrement en WAV 16 kHz mono, sur téléphone et ordinateur, en environnement calme et bruyant, avec plusieurs locuteurs (femmes et hommes) lorsque c'est possible. 

- Fiche de consentement signée par chaque locuteur (usage limité au hackathon et à la recherche, droit de retrait). 

- Nommage normalisé des fichiers et métadonnées (langue, locuteur anonymisé, phrase, conditions) dans un fichier CSV. 

- **Séparation par locuteur** : les locuteurs du jeu de test ne figurent pas dans le jeu d'entraînement. 

#### **8.3 Qualité des données** 

- Vérification d'un échantillon des transcriptions par un locuteur natif ; normalisation (casse, ponctuation, chiffres en lettres) identique pour la référence et la prédiction. 

- Contrôle de la durée, du volume et du taux d'échantillonnage ; rejet des fichiers vides ou saturés. 

- Documentation des volumes réellement utilisés (heures, nombre d'énoncés, locuteurs) dans une fiche de données (data card). 

#### **8.4 Fiche de données (data card)** 

Une fiche de données est livrée avec le dépôt ; ses champs sont fixés dès maintenant et remplis avec les valeurs réellement mesurées : 

|**Champ**|**Contenu attendu**|
|---|---|
|Source et version|Nom,URL,version / commit,date de téléchargement,hash SHA-256 des fichiers utilisés|
|Licence|Licence de chaque source et obligations associées(8.5)|
|Consentement|Pour les enregistrements de l'équipe : formulaire signé,finalité,durée de conservation,droit de retrait|
|Répartition|Par langue, genre, tranche d'âge et locuteur (pseudonymisé) ; heures et nombre d'énoncés par partition<br>(entraînement / validation / test)|
|Protocole d'annotation|Règles de transcription(tons,chiffres,nomspropres),annotation des intentions et entités,outils utilisés|
|Accord inter-annotateurs|Double annotation d'un échantillon (cible ≥ 10 %) ; kappa de Cohen pour les intentions, CER entre<br>transcripteurs;désaccords arbitrés|
|Limites connues|Biais(accents,régions, genre),faible volumeyoruba,conditions d'enregistrement|



#### **8.5 Conformité et licences** 

|**Élément**|**Licence**|**Conséquence pour le projet**|
|---|---|---|
|JML-fon-speech-v1|CC-BY-SA-4.0|Citer la source ; tout jeu de données dérivé publié doit l'être sous la même<br>licence.|
|Corpus Fongbe(Laleye)|CC-BY-4.0|Citer la source.|
|Common Voiceyoruba|CC0|Aucune obligation;citation recommandée.|
|mms-1b-all, mms-tts-fon, mms-|CC-BY-NC-4.0|Usage non commercial uniquement : acceptable pour la démo du hackathon,|
|tts-yor||**à remplacer ou à relicencier avant tout usage commercial** (risque R4).|
|Whisper|MIT|Usage libre, ycompris commercial.|



Une page « Sources et licences » sera incluse dans le README et dans les slides. 

### **9. Plan d'évaluation et critères d'acceptation** 

#### **9.1 Protocole** 

- **Jeu de test séparé et figé** avant tout entraînement : extrait des corpus publics (partitions de test officielles quand elles existent) + enregistrements de l'équipe de locuteurs non vus à l'entraînement. 

- **Baseline** : MMS-1b-all avec adaptateurs d'origine, sans fine-tuning (ASR) ; règles simples par mots-clés (NLU). 

- **Modèle évalué** : adaptateurs MMS affinés (fon, yoruba), Whisper (français, yoruba), NLU règles + petit modèle. 

- **Locuteurs disjoints** : aucun locuteur du jeu de test n'apparaît à l'entraînement ou à la validation ; le jeu de test est figé (hash publié) avant le premier entraînement. 

- **Reproductibilité** : seed fixée, versions figées, scripts eval_asr / eval_nlu / eval_e2e, commande unique documentée dans le README, résultats exportés en CSV. 

#### **9.2 Métriques** 

|**Métrique**|**Niveau**|**Mesure**|**Cible (non mesurée à ce jour)**|
|---|---|---|---|
|WER / CER|ASR, par langue|Sur lejeu de testgénéral et sur le sous-|Fon : réduction relative du WER ≥ 15 %|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 8 

|**Métrique**|**Niveau**|**Mesure**|**Cible (non mesurée à ce jour)**|
|---|---|---|---|
|||ensemble « phrases financières »|vs baseline ; amélioration aussi visée en<br>yoruba|
|Précision et F1 par<br>classe d'intention|NLU|Sur transcriptions de référence et sur sorties ASR<br>; matrice de confusion ; F1 macro|Précision ≥ 85 % ; F1 ≥ 0,80 sur<br>confirmer / annuler /<br>preparer_transfert|
|F1 des entités|NLU|Montant (valeur exacte) et destinataire<br>(correspondance contact)|≥ 0,80|
|Succès de bout en bout|Système|Scénarios scriptés joués à la voix (au moins 10<br>par scénario etpar langue,cible)|≥ 80 % (FR), ≥ 60 % (fon, yoruba)|
|Sécurité de<br>confirmation|Système|Transferts exécutés sans « oui » explicite, y<br>compris caspièges(silence,« non »,bruit)|0 (exigence stricte)|
|Latence|Système|Médiane etp95par étape etpar tour(6.1)|Médiane ≤ 5 s; p95 ≤ 8 s|
|Idempotence|Système|Double confirmation, double clic, requête<br>rejouée|0 double débit (exigence stricte)|



#### **9.3 Critères d'acceptation par parcours** 

_Format : l'utilisateur dit X → le système fait Y en moins de Z s (latence de bout en bout du dernier tour, cible p95). Cas difficile : accent marqué, bruit de marché enregistré, alternance fon/français._ 

|**Parcours**|**Cas**|**L'utilisateur dit (X)**|**Le système fait (Y)**|**Z**|
|---|---|---|---|---|
|Frais|Simple (fon, calme)|« Combien je paie si j'envoie 10 000<br>F ? »|Annonce frais et total conformes à la<br>grille|8 s|
|Frais|Difficile (fon/français,<br>bruit)|Phrase fon avec « dix mille francs »<br>en français,bruit de marché|Même réponse, ou reformulation puis<br>bonne réponse|8 s par tour|
|Solde /<br>budget|Simple (yoruba)|« Combien il me reste ? »|Annonce le solde exact de la base fictive|8 s|
|Solde /<br>budget|Difficile (accent, débit<br>rapide)|« Et cette semaine, j'ai dépensé<br>combien ? »|Total de la semaine exact, ou bascule<br>boutons après 2 échecs|8 s|
|Transfert|Simple (français)|« Envoie 5 000 F à Koffi » puis « oui<br>»|Récapitulatif, puis exécution unique et<br>solde mis àjour|8 s par tour|
|Transfert|Difficile (bruit, « oui »<br>peu audible)|« oui » sous le seuil de confiance|Aucune exécution ; redemande puis<br>bouton Oui/Non|8 s|
|Transfert|Piège|« oui » répété deux fois / requête<br>rejouée|Une seule exécution (même clé<br>d'idempotence)|—|
|Transfert|Piège|« annule »pendant le récapitulatif|Opération annulée,solde inchangé|8 s|
|Anti-arnaque|Simple|Transfert de 200 000 F à un nouveau<br>contact|Alertes AR-01 et AR-02 vocales avant<br>confirmation|8 s|



#### **9.4 Critères d'acceptation du prototype** 

|**N°**|**Critère**|**Vérification**|
|---|---|---|
|CA-1|Les 3 scénarios fonctionnent en direct dans au moins une langue locale et en<br>français.|Démonstration filmée + test en présence de<br>l'équipe|
|CA-2|Aucun transfert n'est exécuté sans confirmation explicite.|Testspièges scriptés, journal d'audit|
|CA-3|Un tableau compare baseline et modèle affiné (WER/CER, intentions,<br>entités,bout en bout,latence)avec les limites identifiées.|Rapport d'évaluation|
|CA-4|Un tiers lance le projet en 5 min (docker compose up) et régénère le tableau<br>des métriquespar make eval.|Test sur machine propre par un autre membre|
|CA-5|Les sources de données et licences sont citées.|README + slides|
|CA-6|Les slides, la vidéo de secours et le formulaire sont soumis avant 21h le 24<br>novembre.|Accusé de soumission|
|CA-7|CI verte : lint, tests unitaires, tests de parcours audio, parité des langues,<br>détection de secrets.|Badge / journal de CI|



#### **9.5 Qualité, tests et reproductibilité** 

|**Volet**|**Exigence**|
|---|---|
|Tests unitaires|Extraction des montants (chiffres et lettres), calcul des frais, machine à états, idempotence, règles AR-01 à<br>AR-05,validation des entrées|
|Tests de parcours|Fichiers audio enregistrés (cas simples et difficiles de 9.3) rejoués automatiquement contre l'API ; résultat<br>attendu vérifié|
|Tests deparité<br>i|Catalogue de messages complet dans les 3 langues(5.8)<br>i   i|
|Reproductibilité|Seeds fixées ; versions figées (package-lock.json, requirements.txt verrouillé) ; hash SHA-256 du dataset ;<br>Docker Compose(web,backend,services IA) ;script unique : make eval → tableau des métriques(CSV +|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 9 

|**Volet**|**Exigence**|
|---|---|
||Markdown)<br>f      i       i|
|CI minimale|À chaque push : lint (ESLint, ruff), tests unitaires et de parité, détection de secrets ; tests audio et évaluation<br>complète lancés manuellement(GPU)|



### **10. Organisation, rôles et planning** 

#### **10.1 Équipe et rôles** 

|**Membre**|**Profil**|**Rôle dans le projet**|
|---|---|---|
|Amos BYLL-CATARIA|ML, reconnaissance et synthèse vocale|ASR/TTS, fine-tuning et entraînement sur GPU, routage par<br>langue|
|Merveille GOMEZ|Licence Économétrie (FASEG-UAC), data<br>science|Données, préparation des jeux, mesures et évaluation,<br>classifieur d'intentions|
|Andy KOUMAGNON|IFRI, fullstack mobile/web, backend JS|Application web, backend Node, portefeuille fictif, intégration<br>de bout en bout|
|Lovia KOUNOUHO|Licence Systèmes Informatiques et<br>Logiciel,Mastergestion deprojet|Coordination, script de phrases, slides, vidéo de secours,<br>soumission du formulaire,contact avec les organisateurs|



#### **10.2 Matrice RACI** 

_R = réalise, A = approuve / responsable final, C = consulté, I = informé._ 

|**Activité**|**Amos**|**Merveille**|**Andy**|**Lovia**|
|---|---|---|---|---|
|Cadrage, planning,suivi|C|C|C|A/R|
|Script dephrases etprotocole d'enregistrement|C|C|I|A/R|
|Enregistrements et consentements|R|R|R|A|
|Préparation des données, jeu de test figé|C|A/R|I|I|
|Baseline ASR(MMS sans fine-tuning)|A/R|C|I|I|
|Fine-tuningASR sur GPU|A/R|C|I|I|
|TTS fon /yoruba / français|A/R|I|C|I|
|NLU : intentions et entités|C|A/R|C|I|
|Backend,machine à états,confirmation|C|I|A/R|I|
|Front web etportefeuille fictif|I|I|A/R|C|
|Module anti-arnaque(règles)|I|C|A/R|C|
|Évaluation et rapport(mesures,limites)|R|A/R|C|I|
|README et reproductibilité|R|R|R|A|
|Slides etpitch|C|C|C|A/R|
|Vidéo de secours|C|I|R|A/R|
|Soumission et contact organisateurs|I|I|I|A/R|



#### **10.3 Planning jour par jour et heure par heure** 

_Horaires indicatifs (heure du Bénin). Un point d'avancement de 15 minutes a lieu à 9h00, 14h00 et 21h00 chaque jour de développement._ 

|**Créneau**|**Activités**|**Responsables**|
|---|---|---|
|**Sam. 21 nov.**|||
|18h30 – 20h00|Lancement, validation du cahier des charges, création du dépôt, répartition<br>des tâches|Lovia (A), tous|
|20h00 – 22h00|Demande / vérification de l'accès GPU ; téléchargement des modèles MMS,<br>Whisper,TTS;téléchargement desjeux de données|Amos, Merveille|
|20h00 – 22h00|**Contrat d'API OpenAPI écrit en premier**; squelette backend Node et front<br>(micro) ;schéma de la base fictive;CI minimale|Andy|
|20h00 – 23h00|Rédaction du script dephrases(annexe A)et de la fiche de consentement|Lovia|
|**Dim. 22 nov.**|||
|08h00 – 12h00|Traductions et enregistrements fon /yoruba / français;contrôlequalité audio|Lovia,tous|
|08h00 – 12h00|Préparation des données,figeage dujeu de test,scripts de métriques|Merveille|
|09h00 – 13h00|Baseline ASR(MMS sans fine-tuning)sur lejeu de test; premier test TTS|Amos|
|09h00 – 18h00|Portefeuille fictif(SQLite), grille de frais,machine à états,confirmation<br>i|Andy|
|14h00 – 22h00|Lancement du fine-tuning des adaptateurs MMS (fon, puis yoruba) ; suivi des<br>courbes|Amos|
|14h00 – 20h00|NLU v1 : règles +jeu d'intentions annoté;baseline NLU<br>i|Merveille|
|20h00 – 23h00|Première intégration ASR → NLU → backend en français|Andy,Amos|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 10 

|**Créneau**|**Activités**|**Responsables**|
|---|---|---|
|**Lun. 23 nov.**|||
|08h00 – 12h00|Évaluation des modèles affinés;second cycle de fine-tuningsi nécessaire|Amos,Merveille|
|08h00 – 13h00|Intégration TTS,interface simplifiée,module anti-arnaque(règles)<br>i i ii    t|Andy|
|09h00 – 13h00|Petit classifieur d'intentions,extraction des montants en lettres|Merveille|
|14h00 – 18h00|Intégration complète des 3 scénarios dans les 3 langues;mesure de latence|Andy,Amos|
|14h00 – 19h00|Trame des slides,storydupitch(persona Mama Rosine)|Lovia|
|19h00 – 23h00|Tests de parcours audio, tests pièges (confirmation, idempotence), parité des<br>langues,test réseau 3G;corrections|Tous|
|**Mar. 24 nov.**|||
|08h00 – 12h00|Gel des fonctionnalités(feature freeze)à 12h;évaluation finale reproductible|Merveille,Amos|
|08h00 – 13h00|ii ii<br>Stabilisation de la démo;README;test de réinstallation|Andy|
|13h00 – 17h00|Rapport d'évaluation (baseline vs modèle, limites) ; intégration des résultats<br>dans les slides|Merveille, Lovia|
|14h00 – 18h00|Tournage et montage de la vidéo de secours|Lovia,Andy|
|18h00 – 20h30|Relecture croisée de tous les livrables,répétition dupitch|Tous|
|**avant 21h00**|**Soumission du formulaire et des livrables** (margejusqu'à 23h59)|Lovia|
|**Mer. 25 nov.**|||
|Matin|Répétition générale, vérification du matériel (micro, réseau local, vidéo de<br>secours)|Tous|
|Selon horaire|**Demi-finale :pitch + démonstration en direct**|Tous|
|Soir|Intégration des retours dujury ;ajustements de la démo et des slides|Tous|
|**Jeu. 26 nov.**|||
|Matin|Répétition finale; plan B vérifié|Tous|
|Selon horaire|**Finale**|Tous|



### **11. Livrables** 

|**N°**|**Livrable**|**Contenu**|**Échéance**|
|---|---|---|---|
|L1|Prototype fonctionnel|Web app vocale + portefeuille fictif ; 3 scénarios ; confirmation<br>obligatoire;dépôt de code|24 nov., avant 21h|
|L2|Résultats comparés à une<br>baseline|Tableau baseline vs modèle (WER/CER par langue, précision des<br>intentions, F1 des entités, bout en bout, latence) avec mesures et<br>limites|24 nov., avant 21h|
|L3|Slides|Problème, persona, solution, démo, résultats, données et licences,<br>modèle économique, pilote|24 nov., avant 21h|
|L4|Dossier de reproductibilité|README « lancer en 5 min », Docker Compose, make eval, scripts,<br>seeds,versions,hash dataset,fiche de données,sources et licences<br>ii|24 nov., avant 21h|
|L5|Contrat d'API|Spécification OpenAPI rédigée avant le code et tenue à jour|21 nov. (v0), 24 nov.<br>(final)|
|L6|Rapport technique|Résultats vs baseline, erreurs typiques (exemples de transcriptions<br>ratées,confusions d'intentions),limites,cequi reste à faire|24 nov., avant 21h|
|L7|Plan pilote chiffré|Section 13 détaillée : partenaire cible, 50–100 utilisateurs, KPIs,<br>méthode d'estimation des coûts,conformité|24 nov., avant 21h|
|L8|Script de démo + plan B|Déroulé minute par minute (11.1), vidéo de secours, audios pré-<br>enregistrés|24 nov.|
|L9|Cahier des charges|Leprésent document|21 nov.|



L1, L2 et L3 sont les livrables exigés par l'organisation ; les autres répondent aux critères de reproductibilité, de qualité des données et de faisabilité d'un pilote. 

#### **11.1 Script de démo (format indicatif de 5 min)** 

|**Minute**|**Contenu**|**Plan B**|
|---|---|---|
|0:00 – 0:45|Problème etpersona Mama Rosine(1 slide)|—|
|0:45 – 1:45|Scénario 2 en fon : solde puis budget|Audio pré-enregistré injecté dans<br>l'application|
|1:45 – 2:45|Scénario 1 enyoruba : frais d'un envoi|Audiopré-enregistré;sinon vidéo|
|2:45 – 4:00|Scénario 3 en français puis fon : transfert, alerte AR-01, « oui » répété → une<br>seule exécution;« annule »|Vidéo de secours (extrait)|
|4:00 – 5:00|Résultats vs baseline(1 slide),limites, pilote|—|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 11 

#### **11.2 Bonnes pratiques du pitch** 

- Distinguer clairement **ce qui fonctionne** (démo en direct, mesures) de **ce qui est maquette ou perspective** (intégration opérateur, PIN réel, pilote) ; étiqueter les écrans maquettés. 

- Slides légères : une idée par slide, chiffres mesurés uniquement, sources et licences en dernière slide. 

- Réponses prêtes : **l'utilisateur répète** → reformulation puis boutons (5.6) ; **le réseau coupe** → timeouts, retry, aucune opération sans confirmation, mode dégradé (ENF-05, ENF-11) ; **deux confirmations** → clé d'idempotence, une seule exécution (5.5) ; **et la licence TTS ?** → risque R4 et feuille de route. 

### **12. Risques et mitigations** 

|**ID**|**Risque**|**Prob.**|**Impact**|**Mitigation**|
|---|---|---|---|---|
|R1|Pas d'accès GPU, ou accès<br>tardif / limité|Moyenne|Élevé|Demande d'accès dès le 21 nov. auprès des organisateurs ; plan B :<br>fine-tuning des seuls adaptateurs MMS (léger), petits lots, GPU cloud<br>gratuit ; plan C : baseline MMS + NLU renforcée et documentation<br>honnête de l'absence de fine-tuning.|
|R2|Qualité audio insuffisante<br>(bruit, micro de mauvaise<br>qualité)|Élevée|Élevé|Normalisation et détection d'activité vocale ; enregistrements en<br>conditions réelles inclus à l'entraînement ; micro externe pour la démo<br>;reformulation et demande de répétition.|
|R3|Peu de données yoruba (≈ 6<br>h Common Voice, rien de<br>publié par J'aime ma<br>langue)|Élevée|Moyen|Comparaison MMS / Whisper ; enregistrements ciblés sur le<br>vocabulaire financier ; NLU tolérante ; présentation transparente des<br>limites en yoruba.|
|R4|Licence CC-BY-NC des<br>modèles MMS (TTS et ASR)|Certaine|Moyen<br>(élevé en<br>phase<br>commerciale<br>)|Acceptable pour la démo ; identifié dans les slides ; feuille de route :<br>voix enregistrées sous licence propre, modèles sous licence permissive<br>ou accord de licence avant tout usage commercial.|
|R5|Manque de temps (3 jours)|Élevée|Élevé|Priorisation MoSCoW stricte ; gel des fonctionnalités le 24 nov. à 12h ;<br>vidéo de secours; points d'avancementquotidiens.|
|R6|Erreur de compréhension<br>menant à un mauvais<br>transfert|Moyenne|Élevé|i<br>Récapitulatif vocal et visuel ; confirmation explicite obligatoire ; seuil<br>de confiance ; annulation par défaut.|
|R7|Latence trop élevée en<br>démo|Moyenne|Moyen|Modèles préchargés en mémoire ; inférence locale ; mesures par<br>étape;réponses TTS fréquentespré-générées.|
|R8|Panne réseau ou matériel le<br>jour de la démo|Faible|Élevé|Démo en réseau local ; ordinateur de secours ; vidéo de secours.|
|R9|Transcriptions tonales<br>hétérogènes entre corpus<br>fon|Moyenne|Moyen|Normalisation unique documentée ; mesure du CER en complément<br>du WER.|



### **13. Perspectives : pilote avec les fintechs partenaires** 

Le prototype est conçu pour pouvoir évoluer vers un pilote encadré avec des acteurs de l'écosystème présents au GPU Challenge (Alliance Fintech UEMOA, PayFonte, UDU Technologies, Kernel), sous réserve de leur intérêt. 

#### **13.1 Phases du pilote (indicatives)** 

|**Phase**|**Contenu**|**Prérequis**|
|---|---|---|
|Phase 0 – Cadrage|Choix d'un partenaire, d'un canal (application, agent, USSD + serveur<br>vocal)et d'ungroupe test restreint d'utilisateurs volontaires|Accord de principe, cadre de<br>confidentialité|
|Phase 1 – Bac à sable|Connexion à un environnement de test (sandbox) d'API de paiement ;<br>grille de frais officielle ; tests avec utilisateurs réels sur portefeuilles de<br>test<br>i   i|Accès sandbox, consentement des<br>testeurs<br>i|
|Phase 2 – Pilote restreint<br>i|Opérations réelles plafonnées, consultation de solde et frais d'abord,<br>transferts ensuite;suivi des erreurs et des alertes de fraude<br>i|Validation sécurité et conformité<br>par lepartenaire<br>i|
|Phase 3 – Évaluation|Mesure de l'autonomie des utilisateurs, du taux d'erreur, de la<br>satisfaction et du coûtpar interaction;décision d'extension|Indicateurs définis conjointement|



#### **13.2 Paramètres du pilote (à chiffrer avec le partenaire)** 

|**Élément**|**Proposition**|
|---|---|
|Partenaire cible|Un opérateur mobile money ou une institution de microfinance (IMF) disposant d'une clientèle de<br>commerçants;appuipossible d'un agrégateur depaiement|
|Échantillon|50 à 100 utilisateurs volontaires(commerçants,majoritairement locuteurs du fon et duyoruba),sur 4 à 8|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 12 

|**Élément**|**Proposition**|
|---|---|
||semaines|
|KPIs|Taux de succès des parcours ; part des opérations réalisées sans aide d'un tiers ; erreurs de montant /<br>destinataire évitées ; alertes de fraude et faux positifs ; satisfaction (enquête orale) ; latence p95 en conditions<br>réelles;rétention|
|Coûts à estimer|Coût GPU d'adaptation (heures GPU × tarif) ; coût d'inférence par requête = (coût horaire du serveur ÷ requêtes<br>traitées par heure, mesuré en charge) ; collecte et annotation de données ; support terrain. Aucun montant<br>n'est avancé avant mesure.|
|Conformité|Loi béninoise sur la protection des données personnelles (Code du numérique) et déclaration / autorisation<br>auprès de l'APDP ; règles de la BCEAO applicables aux services de paiement et à la monnaie électronique,<br>portéespar lepartenaire agréé;analysejuridique à mener avec lepartenaire|



#### **13.3 Conditions de passage au pilote** 

- Remplacement des composants sous licence non commerciale (TTS, et ASR si nécessaire). 

- Authentification de l'utilisateur et protection des données personnelles conformément à la réglementation applicable. 

- Collecte élargie et éthique de données vocales (plus de locuteurs, de régions et de conditions), y compris en yoruba. 

- Renforcement du module anti-arnaque avec les retours et les typologies de fraude observées par le partenaire. 

- Extension possible à d'autres langues nationales selon la disponibilité des données. 

### **Annexe A – Exemples de phrases en français à traduire** 

_Phrases destinées à être traduites en fon et en yoruba par des locuteurs natifs, puis enregistrées. Les montants et les noms varient d'un enregistrement à l'autre._ 

|**Intention**|**Exemples de phrases**|
|---|---|
|demander_frais|Combien je paie si j'envoie dix mille francs ? · Quels sont les frais pour un retrait de vingt-cinq mille francs ? · On m'a<br>pris combienpour mon dernier transfert ? · Pourquoi on m'a retiré de l'argent enplus ?|
|consulter_solde|Combien il me reste sur mon compte ? · Dis-moi mon solde. · Est-ce que j'ai assez d'argent pour envoyer quinze mille<br>francs ?|
|consulter_budget|Combien j'ai dépensé cette semaine ? · Combien il me reste dans mon budget du mois ? · Quelle est ma plus grosse<br>dépense aujourd'hui ?|
|preparer_transfert|Envoie cinq mille francs à Koffi. · Je veux envoyer deux mille cinq cents francs à ma fille. · Transfère trente mille francs<br>à mon fournisseur Moussa.|
|confirmer|Oui. · Oui, envoie. · C'est bon,je confirme.|
|annuler|Non. · Annule. · Attends, ce n'estpas le bon montant.|
|aide|Je ne comprendspas. · Répète, s'il teplaît. ·Qu'est-ceque tupeux faire ?|
|arnaque (message)|Vous avez reçu un transfert par erreur, renvoyez-le. · Donnez votre code secret pour débloquer votre compte. · Vous<br>avezgagné unprix, envoyez des fraispour le recevoir.|
|montants|cinqcents · mille · deux mille cinqcents · dix mille · cinquante mille · cent mille · un million|



### **Annexe B – Glossaire** 

|**Terme**|**Définition**|
|---|---|
|ASR|Reconnaissance automatique de laparole : conversion de l'audio en texte.|
|TTS|Synthèse vocale : conversion du texte en audio.<br>iii  i   i|
|NLU|Compréhension du langage naturel : identification de l'intention et des entités dans unephrase.|
|Intention|But exprimépar l'utilisateur(ex. : consulter le solde,préparer un transfert).|
|Entité|Information à extraire d'unephrase(ex. : montant, destinataire).|
|MMS|Massively Multilingual Speech : famille de modèles de parole de Meta couvrant plus d'un millier de langues, dont le<br>fon et leyoruba.|
|Adaptateur|Petit ensemble deparamètrespropre à une langue, ajouté à ungrand modèle etpouvant être affiné à moindre coût.|
|Whisper|Modèle de reconnaissance vocale multilingue(licence MIT); neprendpas en charge le fon.|
|Fine-tuning|Ré-entraînement d'un modèlepré-entraîné sur des données spécifiques(ici, le domaine financier).|
|Baseline|Système de référence simple auquel on compare le modèleproposé.|
|WER / CER|Taux d'erreur sur les mots / sur les caractères :plus il est bas, meilleure est la transcription.|
|F1|Moyenne harmonique de laprécision et du rappel, utiliséepour évaluer l'extraction d'entités.|
|Latence|Temps entre la fin de laparole de l'utilisateur et le début de la réponse audio.|
|MoSCoW|Méthode depriorisation : Must, Should, Could, Won't.|
|RACI|Matrice de responsabilités : Réalise, Approuve, Consulté, Informé.|
|Portefeuille fictif|Compte simulé(solde, historique, contacts)ne manipulant aucun argent réel.|
|ii<br>KYC|Know Your Customer :procédures d'identification des clients(horspérimètre).|
|CC-BY-SA / CC-BY-NC / CC0|Licences Creative Commons : attribution + partage à l'identique / attribution + usage non commercial / domaine<br>public.|
|Mobile money|Service depaiement et de transfert d'argent via le téléphone mobile.|



KwèGbaTché – Cahier des charges – GPU Challenge 2026 – page 13 

