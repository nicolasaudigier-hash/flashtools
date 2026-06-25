export default async function handler(req, res) {
  const apiKey = process.env.SYSTEME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "SYSTEME_API_KEY manquante dans Vercel" });
  }

  try {
    const [tagsRes, contactsRes] = await Promise.all([
      fetch('https://api.systeme.io/api/tags', {
        headers: { 'X-API-Key': apiKey }
      }),
      fetch('https://api.systeme.io/api/contacts?limit=5', {
        headers: { 'X-API-Key': apiKey }
      })
    ]);

    const tags = await tagsRes.json();
    const contacts = await contactsRes.json();

    res.status(200).json({
      tags_status: tagsRes.status,
      tags,
      contacts_status: contactsRes.status,
      contacts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
