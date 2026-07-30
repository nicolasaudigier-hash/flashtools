export default async function handler(req, res) {
  // Autorise les appels depuis tes pages (GitHub Pages + flashtools.fr)
  res.setHeader('Access-Control-Allow-Origin', '*');
  const apiKey = process.env.SYSTEME_API_KEY;
  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ access: false, error: "email manquant" });
  }
  if (!apiKey) {
    return res.status(500).json({ access: false, error: "config manquante" });
  }
  try {
    const response = await fetch(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}&limit=10`,
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
    const hasActif = tagNames.includes('acces_actif');
    const hasEssai = tagNames.includes('acces_essai');
    const hasEssaiTermine = tagNames.includes('essai_termine');

    // Abonnement payant actif : priorité la plus haute, pas de compte à rebours
    if (hasActif) {
      return res.status(200).json({ access: true, status: 'actif' });
    }

    // Essai en cours : on calcule les jours restants à partir de la date d'inscription
    if (hasEssai) {
      const registeredAt = new Date(contact.registeredAt);
      const now = new Date();
      const elapsedMs = now - registeredAt;
      const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, 7 - elapsedDays);
      return res.status(200).json({ access: true, status: 'essai', daysRemaining });
    }

    // Essai terminé, jamais abonné depuis
    if (hasEssaiTermine) {
      return res.status(200).json({ access: false, status: 'expire' });
    }

    // Contact connu mais aucun tag d'accès
    return res.status(200).json({ access: false, status: 'aucun' });
  } catch (error) {
    res.status(500).json({ access: false, error: error.message });
  }
}
