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
        system: `Tu es FlashDetox, un analyseur de fake news.

Ton rôle : identifier les 5 fake news ou affirmations douteuses qui circulent EN CE MOMENT sur les réseaux sociaux et dans les médias francophones.

RÈGLES :
- Recherche activement sur le web les fake news actuelles en France et dans le monde francophone
- Sélectionne des sujets variés : santé, politique, science, société, environnement
- Exprime toujours un score de probabilité (0-100) que l'affirmation soit vraie
- Inclus l'historique de chaque fake news si elle a déjà circulé par le passé
- Reste factuel et neutre

STRUCTURE — réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "items": [
    {
      "affirmation": "<l'affirmation qui circule — formulée comme une affirmation>",
      "score": <0-100>,
      "analyse": "<analyse factuelle en 2-3 phrases>",
      "historique": "<ex: Apparue en 2020, revient régulièrement... ou Nouvelle affirmation — première circulation détectée cette semaine>"
    }
  ]
}

Retourne exactement 5 items.`,
        messages: [
          {
            role: 'user',
            content: `Quelles sont les 5 principales fake news qui circulent cette semaine ? Nous sommes le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`
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
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'Réponse vide' });

    let result;
    try {
      const clean = textBlock.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Erreur de parsing' });
    }

    // Cache 7 jours
    res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate');
    return res.status(200).json(result);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
