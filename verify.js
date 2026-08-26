export default async function handler(req, res) {
  // Autorise les appels depuis tes pages (GitHub Pages + flashtools.fr)
  res.setHeader('Access-Control-Allow-Origin', '*');
  const apiKey = process.env.SYSTEME_API_KEY;
  const email = req.query.email;
  const product = req.query.product; // absent = comportement FlashTools existant, inchangé

  if (!email) {
    return res.status(400).json({ access: false, error: "email manquant" });
  }
  if (!apiKey) {
    return res.status(500).json({ access: false, error: "config manquante" });
  }

  try {
    const response = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=100`,
      { headers: { 'X-API-Key': apiKey } }
    );
    const data = await response.json();
    const contact = data.items?.find(
      c => c.email.toLowerCase() === email.toLowerCase()
    );

    if (!contact) {
      return res.status(200).json({ access: false, status: 'aucun' });
    }

    const tagNames = (contact.tags || []).map(t => t.name);

    // ── Branche FlashCoffreFort ──────────────────────────────
    // Distincte de la logique FlashTools : pas d'essai, pas de
    // décompte de jours calculé ici (c'est le workflow Systeme.io
    // qui retire le tag au bon moment — 7j / 30j / résiliation).
    // On se contente de vérifier la présence d'un des 3 tags.
    if (product === 'flashcoffrefort') {
      const tierTags = {
        annuel: 'flashcoffrefort-annuel',
        '30j': 'flashcoffrefort-30j',
        '7j': 'flashcoffrefort-unique',
      };
      for (const [tier, tagName] of Object.entries(tierTags)) {
        if (tagNames.includes(tagName)) {
          return res.status(200).json({ access: true, status: tier });
        }
      }
      return res.status(200).json({ access: false, status: 'aucun' });
    }

    // ── Branche FlashTools existante, inchangée ─────────────
    const hasActif = tagNames.includes('acces_actif');
    const hasEssai = tagNames.includes('acces_essai');
    const hasEssaiTermine = tagNames.includes('essai_termine');

    if (hasActif) {
      return res.status(200).json({ access: true, status: 'actif' });
    }
    if (hasEssai) {
      const registeredAt = new Date(contact.registeredAt);
      const now = new Date();
      const elapsedMs = now - registeredAt;
      const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 7 - elapsedDays);
      return res.status(200).json({ access: true, status: 'essai', daysRemaining });
    }
    if (hasEssaiTermine) {
      return res.status(200).json({ access: false, status: 'expire' });
    }
    return res.status(200).json({ access: false, status: 'aucun' });

  } catch (error) {
    res.status(500).json({ access: false, error: error.message });
  }
}
