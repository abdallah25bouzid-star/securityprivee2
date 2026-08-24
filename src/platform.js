// ─────────────────────────────────────────────────────────────
// Adaptateur "plateforme" pour faire tourner l'app HORS de l'aperçu Claude.
// 1) Remplace window.storage (qui n'existe que dans l'aperçu) par le
//    stockage local du navigateur (localStorage) — l'app fonctionne
//    immédiatement, sans base de données, sur l'appareil.
// 2) Redirige les appels IA (api.anthropic.com) vers /api/claude, un petit
//    serveur qui garde ta clé API secrète (voir api/claude.js).
//
// Pour passer en multi-utilisateurs (données partagées entre tous les
// téléphones + stockage des scans), remplace la partie ci-dessous par un
// client Supabase/Firebase — l'interface (get/set/delete) reste la même.
// ─────────────────────────────────────────────────────────────

const LS = window.localStorage;

window.storage = {
  async get(key /*, shared */) {
    const v = LS.getItem(key);
    return v == null ? null : { key, value: v };
  },
  async set(key, value /*, shared */) {
    LS.setItem(key, value);
    return { key, value };
  },
  async delete(key /*, shared */) {
    LS.removeItem(key);
    return { key, deleted: true };
  },
  async list(prefix = '' /*, shared */) {
    const keys = [];
    for (let i = 0; i < LS.length; i++) {
      const k = LS.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return { keys, prefix };
  },
};

// Redirige les requêtes IA vers ton proxy serveur (clé API protégée).
const _fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const url = typeof input === 'string' ? input : input && input.url;
    if (url && url.indexOf('api.anthropic.com/v1/messages') !== -1) {
      return _fetch('/api/claude', init);
    }
  } catch (e) {}
  return _fetch(input, init);
};
