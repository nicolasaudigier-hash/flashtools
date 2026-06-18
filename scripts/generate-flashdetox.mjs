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

const SYSTEM_PROMPT =
