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
      return res.status(200).json({ access: false });
    }

    const tagNames = (contact.tags || []).map(t => t.name);
    const hasAccess = tagNames.includes('acces_actif') || tagNames.includes('acces_essai');

    res.status(200).json({ access: hasAccess });
  } catch (error) {
    res.status(500).json({ access: false, error: error.message });
  }
}
