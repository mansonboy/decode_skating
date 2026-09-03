# Déploiement de la fonction "Décode ma feuille de note"

## 1. Créer un compte Vercel
Va sur https://vercel.com et connecte-toi (gratuit, tu peux utiliser GitHub, GitLab ou email).

## 2. Déployer ce dossier
Deux façons de faire, choisis la plus simple pour toi :

**Option A — via GitHub (recommandé, permet de re-déployer facilement plus tard)**
1. Crée un nouveau dépôt GitHub (ex: `fiche-decode-api`) et pousse le contenu de ce dossier dedans.
2. Sur Vercel : "Add New Project" → importe ce dépôt GitHub → clique "Deploy".

**Option B — via la CLI Vercel (plus rapide pour un test)**
```bash
npm install -g vercel
cd fiche-decode-api
vercel
```
Suis les instructions à l'écran (connexion, nom du projet, etc.).

## 3. Ajouter ta clé API Anthropic
Dans le dashboard Vercel de ton projet : **Settings → Environment Variables**
- Nom : `ANTHROPIC_API_KEY`
- Valeur : ta clé API (créée sur https://platform.claude.com → Console → API Keys)

Puis redéploie (Vercel te le proposera automatiquement, ou fais "Redeploy" depuis l'onglet Deployments).

## 4. Adapter le CORS
Dans `api/decode-fiche.js`, tout en haut, vérifie que `ALLOWED_ORIGIN` correspond bien à ton domaine :
```js
const ALLOWED_ORIGIN = 'https://frenchranking.daurelthomas.fr';
```

## 5. Récupérer l'URL de ta fonction
Une fois déployé, Vercel te donne une URL du type :
```
https://fiche-decode-api.vercel.app
```
Ta fonction sera accessible à :
```
https://fiche-decode-api.vercel.app/api/decode-fiche
```

C'est cette URL que tu mets dans `API_URL` du composant React `FicheDecode.js`.

## 6. Tester rapidement (optionnel)
```bash
curl -X POST https://fiche-decode-api.vercel.app/api/decode-fiche \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "...", "mediaType": "image/jpeg"}'
```

## Coût attendu
Avec Haiku 4.5 (~0,004 $ par feuille analysée), 1000 feuilles analysées ≈ 4 $. Le rate-limit intégré (15 requêtes/IP/heure) protège contre les abus basiques.
