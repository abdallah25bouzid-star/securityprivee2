# Buckler Security — projet complet (site web + APK Android)

Ce dossier est le projet **prêt à construire**. Il contient toute l'app
(`src/App.jsx`) plus la configuration pour en faire un **site web installable**
(PWA) et une **application Android (APK)**.

> Prérequis : installer **Node.js 18+** (https://nodejs.org). Sur Windows/Mac,
> installer aussi **VS Code** pour éditer. Pour l'APK : **Android Studio**.

---

## 1) Lancer l'app en local (test immédiat)

```bash
npm install
npm run dev
```

Ouvre l'adresse affichée (http://localhost:5173). L'app tourne, les données
sont enregistrées **sur ton appareil** (localStorage). Login responsable :
`admin` / `admin`.

---

## 2) Mettre le SITE WEB en ligne (gratuit, ~5 min)

Le plus simple : **Vercel**.

1. Crée un compte sur https://vercel.com (connecte ton GitHub).
2. Mets ce dossier sur un dépôt GitHub (ou glisse-le dans Vercel).
3. Vercel détecte Vite tout seul → **Deploy**.
4. Tu obtiens une adresse type `https://buckler-security.vercel.app`.

Tu peux partager ce lien à tes agents : ils l'ouvrent sur le téléphone.

### Installer le site comme une APP (PWA — sans store)

Une fois en ligne, sur le téléphone : ouvre le lien →
- **Android/Chrome** : menu ⋮ → « Ajouter à l'écran d'accueil / Installer ».
- **iPhone/Safari** : Partager → « Sur l'écran d'accueil ».

→ Icône comme une vraie app, plein écran. **0 €, aucune validation.**

---

## 3) Activer l'IA (copilote, générateur de planning, résumé)

Les fonctions IA appellent le fichier `api/claude.js`, qui garde ta **clé API
Anthropic secrète**.

1. Récupère une clé API sur https://console.anthropic.com (commence par `sk-ant-...`).
2. Sur Vercel → ton projet → **Settings → Environment Variables** → ajoute :
   - `ANTHROPIC_API_KEY` = ta clé
3. **Redeploy**. Les boutons IA de l'app fonctionnent automatiquement.

> Tant que la clé n'est pas configurée, l'app marche normalement ; seuls les
> boutons IA affichent un message d'erreur.

---

## 4) Générer l'APK Android

Tu as **deux voies fiables**. La (A) est la plus simple.

### (A) PWABuilder — sans code, le plus rapide
1. Déploie d'abord le site (étape 2).
2. Va sur https://www.pwabuilder.com , colle l'adresse de ton site.
3. Clique **Package for stores → Android** → télécharge le paquet signé
   (`.apk` de test + `.aab` pour le Google Play Store).

### (B) Capacitor — vraie app native (plus de contrôle)
Nécessite **Android Studio** installé.

```bash
npm install
npm run build
npm run android:add      # crée le dossier android/ (à faire une seule fois)
npm run android:sync     # build web + synchronise dans Android
npm run android:open     # ouvre Android Studio
```

Dans Android Studio : **Build → Build APK(s)** → récupère le `.apk`
dans `android/app/build/outputs/apk/`.

> Pour publier sur le **Google Play Store** : compte développeur Google
> (25 $ une fois), fournir un `.aab` signé + fiche + captures.

---

## 5) (Recommandé plus tard) Passer en multi-utilisateurs

Aujourd'hui les données sont **locales à chaque appareil** (localStorage).
Pour que responsable et agents voient **le même planning en temps réel** et
stocker les **scans de documents**, branche une base **Supabase** (gratuit) :

- Remplace le contenu de `src/platform.js` par un client Supabase exposant
  la même interface `window.storage` (`get` / `set` / `delete`).
- Ou demande à un développeur : le reste de l'app ne change pas.

---

## Structure du projet

```
buckler-app/
├── src/
│   ├── App.jsx          ← toute l'application (ne pas casser)
│   ├── main.jsx         ← point d'entrée
│   ├── platform.js      ← stockage local + redirection IA
│   └── index.css        ← Tailwind
├── api/claude.js        ← proxy IA (clé secrète, Vercel)
├── public/icon.svg      ← icône de l'app
├── index.html
├── vite.config.js       ← config + PWA
├── tailwind.config.js
├── postcss.config.js
├── capacitor.config.json← config APK Android
└── package.json
```

---

## Récap express

| Objectif | Commande / action |
|---|---|
| Tester en local | `npm install` puis `npm run dev` |
| Mettre le site en ligne | Vercel → Deploy |
| Installer comme app | Ouvrir le lien → « Ajouter à l'écran d'accueil » |
| Activer l'IA | Variable `ANTHROPIC_API_KEY` sur Vercel |
| Faire l'APK (facile) | PWABuilder.com → Android |
| Faire l'APK (natif) | `npm run android:add` → Android Studio |

Bonne mise en ligne 🚀
