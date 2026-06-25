export default async function handler(req, res) {
  const apiKey = process.env.SYSTEME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "SYSTEME_API_KEY manquante dans Vercel" });
  }

  try {
    const [byEmailRes, byTagRes] = await Promise.all([
      fetch('https://api.systeme.io/api/contacts?email=nicolas.audigier@gmail.com&limit=10', {
        headers: { 'X-API-Key': apiKey }
      }),
      fetch('https://api.systeme.io/api/contacts?tags[]=2068632&limit=10', {
        headers: { 'X-API-Key': apiKey }
      })
    ]);

    const byEmail = await byEmailRes.json();
    const byTag = await byTagRes.json();

    res.status(200).json({
      byEmail_status: byEmailRes.status,
      byEmail,
      byTag_status: byTagRes.status,
      byTag
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
