export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { affirmation } = req.body;
  if (!affirmation) return res.status(400).json({ error: 'Affirmation manquante' });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'tools-2024-04-04'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Tu es FlashDetox, un analyseur d'affirmations rigoureux et nuancé.

Ton rôle : analyser une affirmation soumise par un utilisateur et retourner une analyse structurée en JSON.

RÈGLES IMPORTANTES :
- Tu ne dis jamais "VRAI" ou "FAUX" de manière absolue
- Tu exprimes toujours un taux de probabilité de 0 à 100
- Tu distingues "preuves contraires trouvées" et "information invérifiable"
- Tu restes neutre et factuel
- Tu utilises obligatoirement la recherche web avant de répondre
- Tu recherches aussi si cette affirmation a déjà circulé dans le passé

STRUCTURE DE RÉPONSE — réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "score": <nombre entre 0 et 100 — probabilité que l'affirmation soit vraie>,
  "circule": "<reformulation neutre de ce qui circule — 1-2 phrases>",
  "web": "<ce que les sources web disent — 2-3 phrases factuelles>",
  "analyse": "<raisonnement détaillé — 3-4 phrases>",
  "conclusion": "<verdict nuancé en 2 phrases maximum>",
  "historique": [
    { "date": "<année ou période>", "description": "<contexte d'apparition>" }
  ],
  "sources": ["<source 1>", "<source 2>", "<source 3>"]
}

Le tableau historique peut être vide [] si l'affirmation est récente ou inconnue.
Ne jamais inventer de sources — utilise uniquement ce que tu as trouvé.`,
        messages: [
          {
            role: 'user',
            content: `Analyse cette affirmation : "${affirmation}"`
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(500).json({ error: 'Erreur API Anthropic' });
    }

    const data = await response.json();

    // Extraire le texte de la réponse
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'Réponse vide' });

    // Parser le JSON
    let result;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Erreur de parsing' });
    }

    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
