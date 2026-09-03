// api/decode-fiche.js
//
// Fonction serverless Vercel (Node.js, aucune config particulière requise).
// Reçoit une image encodée en base64, appelle l'API Claude avec vision,
// et renvoie un résumé structuré en JSON.
//
// Variable d'environnement requise sur Vercel : ANTHROPIC_API_KEY

// ⚠️ Change ceci pour l'URL exacte de ton site (sans slash final)
const ALLOWED_ORIGIN = 'https://frenchranking.daurelthomas.fr';

// Rate limit très simple en mémoire : max 15 requêtes / IP / heure.
// Limite : ça se réinitialise si la fonction "redémarre" (cold start) et ne
// tient pas compte du multi-région. Suffisant pour démarrer ; si le site
// prend du trafic, migrer vers Upstash Redis (free tier) pour un vrai
// rate-limit persistant.
const RATE_LIMIT = 15;
const WINDOW_MS = 60 * 60 * 1000; // 1 heure
const requestLog = new Map(); // ip -> [timestamps]

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

const SYSTEM_PROMPT = `Tu es un assistant qui explique des feuilles de notation de patinage artistique (protocole ISU) à des parents et débutants qui ne connaissent pas le jargon technique.

On va te donner une photo d'une feuille de note. Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown, respectant exactement ce format :

{
  "patineur": "nom du patineur tel qu'écrit sur la feuille",
  "nation": "code nation (ex: FRA)",
  "rang": "rang/place tel qu'indiqué",
  "score_total": "score total tel qu'indiqué",
  "score_elements": "total des éléments techniques",
  "score_composantes": "total des composantes du programme",
  "points_forts": ["1 à 3 phrases courtes en français sur ce qui a été bien exécuté, basées sur les GOE positifs ou proches de 0"],
  "points_a_travailler": ["1 à 3 phrases courtes en français sur les éléments avec les GOE les plus négatifs, en expliquant simplement pourquoi ça a pu être pénalisé (vitesse, rotation, réception, centrage, etc.)"],
  "resume": "un paragraphe court (3-4 phrases) résumant la performance dans un langage simple, pour quelqu'un qui ne connaît pas le patinage"
}

Si un champ est illisible sur l'image, mets "non lisible" comme valeur plutôt que d'inventer.`;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Trop de requêtes. Réessaie dans quelques minutes.' });
    return;
  }

  try {
    const { imageBase64, mediaType } = req.body || {};

    if (!imageBase64 || !mediaType) {
      res.status(400).json({ error: 'Image manquante.' });
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
      res.status(400).json({ error: 'Format d\'image non supporté (jpeg, png ou webp uniquement).' });
      return;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBase64 },
              },
              {
                type: 'text',
                text: 'Voici la feuille de note à analyser. Réponds uniquement avec le JSON demandé.',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Erreur API Anthropic :', errText);
      res.status(502).json({ error: "Erreur lors de l'analyse de l'image." });
      return;
    }

    const data = await response.json();
    const rawText = data.content?.find((b) => b.type === 'text')?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Réponse non-JSON reçue :', rawText);
      res.status(502).json({ error: "Impossible d'interpréter le résultat. Réessaie avec une photo plus nette." });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    console.error('Erreur serveur :', err);
    res.status(500).json({ error: 'Erreur serveur inattendue.' });
  }
};
