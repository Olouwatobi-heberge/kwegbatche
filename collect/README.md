# Collecte de voix KwèGbaTché

Page mobile pour enregistrer des phrases en fon, en yoruba et en français. Le lien est public. Seule la page `/admin` demande un code.

Les enregistrements passent par le serveur. La clé Supabase ne va jamais dans le navigateur.

## Comptes et variables

Il faut :

- Node.js 20 ou plus, pour l'essai local
- un compte gratuit [Supabase](https://supabase.com)
- un compte gratuit [Vercel](https://vercel.com)

Variables :

| Variable | Rôle |
| --- | --- |
| `ADMIN_CODE` | Code de `/admin`. 8 caractères minimum. Ne pas le mettre dans le lien public. |
| `SUPABASE_URL` | URL du projet Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète `service_role`. Serveur seulement. |
| `SUPABASE_BUCKET` | `recordings` |
| `SUPABASE_EXPORT_BUCKET` | `exports` |
| `RATE_LIMIT_SALT` | Chaîne aléatoire. Sert à ne pas stocker les adresses IP en clair. |

Générer un code :

```bash
node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
```

## Essai local, sans Supabase

Les fichiers restent dans `collect/.data/` (ignoré par Git).

```bash
cd collect
cp .env.example .env.local
```

Écrire `ADMIN_CODE` dans `.env.local`, puis :

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:3000`. Page équipe : `http://localhost:3000/admin`.

Le micro exige `localhost` ou HTTPS.

## Supabase

1. Créer un projet. Choisir une région proche, par exemple Europe de l'Ouest. Attendre la fin.
2. SQL Editor, New query. Coller tout `collect/supabase/schema.sql`. Run.
   Projet déjà créé : coller aussi `collect/supabase/002_gender.sql`. Run. Les lignes déjà là ne sont pas effacées.
3. Storage. Vérifier les buckets privés `recordings` et `exports`. S'ils manquent : New bucket, nom exact, Public désactivé. Limite 2 Mo pour `recordings`.
4. Project Settings, API.
   - Project URL : `SUPABASE_URL`
   - clé `service_role` (secret) : `SUPABASE_SERVICE_ROLE_KEY`

Ne copiez pas la clé `anon` : l'application ne l'utilise pas.

## Vercel

1. Importer le dépôt GitHub.
2. Root Directory : `collect`. Framework : Next.js.
3. Ajouter les variables avant le premier déploiement.
4. Deploy.
5. Ouvrir l'URL `https://votre-app.vercel.app` sur un téléphone.

`NEXT_PUBLIC_` ne doit préfixer aucune clé. Après un changement de variable, redéployer.

## Partager

Envoyer seulement `https://votre-app.vercel.app` (WhatsApp, SMS, etc.). Aucun code côté contributeur.

L'aperçu reprend le titre de la page. Si le micro ne s'ouvre pas dans WhatsApp : menu, puis Ouvrir dans le navigateur (Chrome sur Android, Safari sur iPhone).

## Parcours contributeur

1. Lire l'accueil, puis accepter.
2. Choisir la langue. Le code locuteur, le sexe (Femme ou Homme) et l'âge sont facultatifs. Pas de nom, pas de numéro.
3. Une phrase à la fois : enregistrer, écouter, envoyer. Précédent et Suivant changent de phrase sans enregistrer. Maximum 15 secondes, 2 Mo.
4. Si `fon` ou `yo` est vide, la phrase française s'affiche. La personne la dit dans sa langue.

La progression reste sur le téléphone. Le code locuteur sert à continuer, ou à demander une suppression.

## Valider et exporter

1. Ouvrir `/admin` et entrer `ADMIN_CODE`.
2. Filtrer par langue et par statut. Écouter. Garder ou rejeter.
3. Les compteurs par langue et par locuteur sont en haut.
4. Exporter seulement les pistes gardées : CSV, JSONL ou ZIP.

Colonnes : `file_path`, `language`, `intent`, `phrase_id`, `sentence`, `speaker_code`, `status`, `duration_ms`, `gender`, `age_range`, `fallback_fr`.

Dans le ZIP, `file_path` est aussi le chemin du fichier. Dans Supabase, c'est le chemin dans le bucket `recordings`.

`fallback_fr` vaut `true` quand la traduction manquait : l'audio est dans la langue choisie, le texte affiché était le français. Ne pas utiliser ces pistes comme paires audio / texte tant que `fon` ou `yo` n'est pas rempli. Le lien se fait avec `phrase_id`.

## Traductions

`script/phrases.csv` contient un brouillon fon et yoruba à faire relire. Les notes et niveaux de confiance sont dans `script/phrases_fon_yo_sources.csv`. Une case vide affiche le français. Après une correction, redéployer.

## Suppression

La personne communique son code locuteur à l'équipe (par la personne qui a envoyé le lien).

Dans Supabase : table `recordings`, filtre `speaker_code`, supprimer les lignes. Puis Storage, bucket `recordings`, supprimer les fichiers indiqués par `storage_path`.

## Limites

- Audio seulement : type MIME et en-tête du fichier (wav, webm, m4a, mp3, ogg).
- 2 Mo, entre une demi-seconde et 20 secondes.
- Champ invisible à laisser vide (piège à robots).
- Quotas par adresse IP et par code locuteur. Défauts dans `src/lib/limits.ts`.
- Les IP sont hashées, pas stockées en clair.
- 15 essais de code admin en 15 minutes, puis une pause.

Salle de classe sur une seule connexion : augmenter `COLLECT_LIMIT_IP_PER_HOUR` dans Vercel, puis redéployer.

Si le ZIP est trop lourd, filtrer une langue ou prendre le CSV. Les fichiers restent dans Storage.

## Dépannage

- « Le code équipe n'est pas configuré » : `ADMIN_CODE` absent ou trop court.
- « Stockage non configuré » sur Vercel : `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` manquant.
- Micro bloqué : Chrome ou Safari, hors de la fenêtre WhatsApp. Sinon, bouton Importer un audio.
- Bucket introuvable : relancer `supabase/schema.sql`, ou créer `recordings` et `exports` à la main, privés.
