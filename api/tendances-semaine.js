export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Tu es FlashDetox, un analyseur de tendances douteuses.

Ton rôle : identifier les sujets, affirmations ou narratifs qui suscitent actuellement le plus de débats, de désinformation ou de confusion dans les médias et réseaux sociaux francophones.

Ce ne sont pas forcément des fake news avérées — ce sont des sujets où la vérité est floue, contestée ou instrumentalisée.

RÈGLES :
- Recherche activement sur le web les sujets tendance actuels
- Sélectionne des sujets variés : politique, santé, économie, environnement, technologie
- Exprime un score de probabilité (0-100) que l'affirmation soit vraie
- Sois nuancé — certains sujets sont complexes, pas binaires
- Inclus l'historique si le sujet revient cycliquement

STRUCTURE — réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "items": [
    {
      "affirmation": "<l'affirmation ou narratif qui circule>",
      "score": <0-100>,
      "contexte": "<2 phrases — pourquoi ce sujet circule en ce moment>",
      "historique": "<une ligne — contexte temporel de cette affirmation>",
      "web": "<ce que les sources sérieuses disent — 2-3 phrases>",
      "analyse": "<raisonnement nuancé — 2-3 phrases>",
      "conclusion": "<verdict mesuré — 1-2 phrases>",
      "sources": ["<source 1>", "<source 2>"]
    }
  ]
}

Retourne exactement 4 items.`,
        messages: [
          {
            role: 'user',
            content: `Quels sont les 4 sujets ou affirmations les plus débattus et potentiellement trompeurs qui circulent cette semaine ? Nous sommes le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
          }
        ]
      })
    });

    if (!response.ok) throw new Error('Erreur API');

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) throw new Error('Réponse vide');

    const clean = textBlock.text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Cache 3.5 jours (mis à jour 2x/semaine)
    res.setHeader('Cache-Control', 's-maxage=302400, stale-while-revalidate');
    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
