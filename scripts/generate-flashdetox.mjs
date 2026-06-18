// scripts/generate-flashdetox.mjs
//
// Exécuté une seule fois par semaine par .github/workflows/update-flashdetox.yml
// Appelle l'API Anthropic (avec l'outil de recherche web) pour générer le
// contenu des deux onglets de FlashDetox, valide la structure obtenue, puis
// écrit les fichiers JSON consommés par flashdetox.html.
//
// La clé API n'est JAMAIS exposée au navigateur — elle vit uniquement comme
// secret GitHub Actions (variable d'environnement ANTHROPIC_API_KEY) pendant
// l'exécution de ce script côté serveur GitHub.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.FLASHDETOX_MODEL || 'claude-sonnet-4-6';

if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY manquant — ajoute-le dans Settings > Secrets and variables > Actions de ton repo GitHub.');
  process.exit(1);
}

const SYSTEM_PROMPT = `Tu es le rédacteur de FlashDetox, une rubrique de vérification d'affirmations pour un public français d'artisans et indépendants. Ton rôle est factuel et neutre, jamais militant.

Règles strictes :
- Choisis des affirmations qui circulent réellement actuellement (utilise la recherche web pour t'en assurer), pas des exemples inventés.
- Sur les sujets politiquement ou socialement sensibles (immigration, religion, partis, conflits), reste strictement neutre : présente les faits vérifiables et les limites méthodologiques des études, sans prendre parti.
- N'aborde jamais de sujets pouvant inciter à la violence, mettre en danger des personnes, ou relevant de théories du complot extrémistes — choisis plutôt des affirmations d'actualité générale (santé, technologie, économie, environnement, société).
- Chaque source citée dans "sources" doit être une organisation ou un rapport réel que tu as identifié via la recherche — jamais une source inventée.
- "score" est un entier de 0 à 100 représentant la probabilité que l'affirmation soit vraie (0 = très probablement fausse, 100 = très probablement vraie).
- Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown. Format exact :
{"items":[{"affirmation":"...","score":0,"contexte":"...","historique":"...","web":"...","analyse":"...","conclusion":"...","sources":["...","..."]}]}`;

const PROMPTS = {
  semaine: 'Identifie 3 affirmations fausses ou trompeuses ("fake news") qui ont circulé cette semaine sur les réseaux sociaux ou dans les médias français. Pour chacune, vérifie les faits via la recherche web avant de répondre.',
  tendances: 'Identifie 2 affirmations douteuses mais plus anciennes et récurrentes (pas forcément de cette semaine précise), du type idée reçue persistante ou débat de fond mal tranché dans l\'opinion publique française. Vérifie les faits via la recherche web avant de répondre.',
};

async function callClaude(promptKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: PROMPTS[promptKey] }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Appel API échoué (${promptKey}) — statut ${response.status} : ${errText}`);
  }

  const data = await response.json();
  const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text);
  const fullText = textBlocks.join('\n').trim();

  const cleaned = fullText.replace(/^```json\s*|^```\s*|```$/g, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Réponse non-JSON pour "${promptKey}" : ${fullText.slice(0, 300)}`);
  }

  validateItems(parsed, promptKey);
  return parsed;
}

function validateItems(parsed, promptKey) {
  if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error(`Structure JSON invalide pour "${promptKey}" — pas de tableau "items" exploitable.`);
  }
  for (const item of parsed.items) {
    const required = ['affirmation', 'score', 'contexte', 'historique', 'web', 'analyse', 'conclusion'];
    for (const field of required) {
      if (item[field] === undefined || item[field] === null || item[field] === '') {
        throw new Error(`Champ "${field}" manquant dans un item de "${promptKey}".`);
      }
    }
    const score = Number(item.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error(`Score invalide (${item.score}) dans un item de "${promptKey}".`);
    }
    item.score = Math.round(score);
    if (!Array.isArray(item.sources)) item.sources = [];
  }
}

async function main() {
  const fs = await import('node:fs/promises');
  const generatedAt = new Date().toISOString();

  const results = {};
  for (const key of Object.keys(PROMPTS)) {
    console.log(`Génération du contenu "${key}"...`);
    try {
      results[key] = await callClaude(key);
      results[key].generatedAt = generatedAt;
    } catch (e) {
      // On ne touche pas au fichier existant si la génération échoue —
      // mieux vaut garder l'ancien contenu (ou la démo) qu'écrire un fichier
      // cassé qui ferait planter l'affichage pour toute la semaine.
      console.error(`Échec pour "${key}", fichier existant conservé :`, e.message);
      results[key] = null;
    }
  }

  if (results.semaine) {
    await fs.writeFile('./data/flashdetox-semaine.json', JSON.stringify(results.semaine, null, 2) + '\n');
    console.log('data/flashdetox-semaine.json mis à jour.');
  }
  if (results.tendances) {
    await fs.writeFile('./data/flashdetox-tendances.json', JSON.stringify(results.tendances, null, 2) + '\n');
    console.log('data/flashdetox-tendances.json mis à jour.');
  }

  if (!results.semaine && !results.tendances) {
    console.error('Aucune génération n\'a réussi cette semaine.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
