// Proxy serveur pour l'IA (copilote, générateur de planning, résumé).
// Il garde ta clé API Anthropic SECRÈTE (jamais exposée au navigateur).
//
// Déploiement (Vercel) :
//  - place ce fichier dans /api/claude.js
//  - dans Vercel > Settings > Environment Variables, ajoute :
//      ANTHROPIC_API_KEY = ta_clé_(commence par sk-ant-...)
//  - redéploie. Les boutons IA de l'app marcheront automatiquement.
//
// (Sur Netlify/Cloudflare, adapte en Netlify Function / Worker.)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
