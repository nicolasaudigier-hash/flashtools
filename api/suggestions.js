export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!API_KEY || !BASE_ID) {
    return res.status(500).json({ error: 'config manquante' });
  }

  const AIRTABLE_URL = `https://api.airtable.com/v0/${BASE_ID}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  };

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');
  }

  try {
    // ------------------------------------------------------------------
    // GET : liste des suggestions, triées par nombre de votes décroissant
    // ------------------------------------------------------------------
    if (req.method === 'GET') {
      const url = `${AIRTABLE_URL}/Suggestions?sort[0][field]=Votes&sort[0][direction]=desc&sort[1][field]=Date&sort[1][direction]=desc`;
      const response = await fetch(url, { headers });
      const data = await response.json();

      if (!response.ok) {
        return res.status(500).json({ error: data.error?.message || 'erreur Airtable' });
      }

      // On ne renvoie jamais l'email dans la liste publique
      const items = (data.records || []).map(r => ({
        id: r.id,
        texte: r.fields.Texte || '',
        prenom: r.fields.Prenom || '',
        votes: r.fields.Votes || 0,
        date: r.fields.Date || null
      }));

      return res.status(200).json({ items });
    }

    // ------------------------------------------------------------------
    // POST : création d'une suggestion, ou vote sur une suggestion
    // ------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action;

      // --- Créer une suggestion ---
      if (action === 'create') {
        const texte = (body.texte || '').trim();
        const prenom = (body.prenom || '').trim();
        const email = (body.email || '').trim();

        if (!texte || texte.length < 5) {
          return res.status(400).json({ error: 'texte trop court' });
        }
        if (texte.length > 1000) {
          return res.status(400).json({ error: 'texte trop long' });
        }
        if (!isValidEmail(email)) {
          return res.status(400).json({ error: 'email invalide' });
        }

        const createResp = await fetch(`${AIRTABLE_URL}/Suggestions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fields: {
              Texte: texte,
              Prenom: prenom,
              Email: email,
              Date: new Date().toISOString(),
              Votes: 0
            }
          })
        });
        const created = await createResp.json();

        if (!createResp.ok) {
          return res.status(500).json({ error: created.error?.message || 'erreur création' });
        }

        return res.status(200).json({
          success: true,
          item: {
            id: created.id,
            texte: created.fields.Texte,
            prenom: created.fields.Prenom,
            votes: created.fields.Votes || 0,
            date: created.fields.Date
          }
        });
      }

      // --- Voter pour une suggestion existante ---
      if (action === 'vote') {
        const suggestionId = (body.id || '').trim();
        const email = (body.email || '').trim();

        if (!suggestionId || !isValidEmail(email)) {
          return res.status(400).json({ error: 'paramètres invalides' });
        }

        // Vérifie qu'un vote n'existe pas déjà pour cet email sur cette suggestion
        const filterFormula = encodeURIComponent(
          `AND({SuggestionID}='${suggestionId}', {EmailVotant}='${email}')`
        );
        const checkResp = await fetch(
          `${AIRTABLE_URL}/Votes?filterByFormula=${filterFormula}`,
          { headers }
        );
        const checkData = await checkResp.json();

        if (!checkResp.ok) {
          return res.status(500).json({ error: checkData.error?.message || 'erreur vérification' });
        }

        if ((checkData.records || []).length > 0) {
          return res.status(200).json({ success: false, error: 'deja_vote' });
        }

        // Récupère le nombre de votes actuel de la suggestion
        const getResp = await fetch(`${AIRTABLE_URL}/Suggestions/${suggestionId}`, { headers });
        const suggestion = await getResp.json();

        if (!getResp.ok) {
          return res.status(404).json({ error: 'suggestion introuvable' });
        }

        const currentVotes = suggestion.fields.Votes || 0;
        const newVotes = currentVotes + 1;

        // Enregistre le vote (empêche les votes multiples)
        const voteResp = await fetch(`${AIRTABLE_URL}/Votes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fields: { SuggestionID: suggestionId, EmailVotant: email }
          })
        });
        if (!voteResp.ok) {
          const voteErr = await voteResp.json();
          return res.status(500).json({ error: voteErr.error?.message || 'erreur enregistrement vote' });
        }

        // Met à jour le compteur de votes sur la suggestion
        const updateResp = await fetch(`${AIRTABLE_URL}/Suggestions/${suggestionId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ fields: { Votes: newVotes } })
        });
        const updated = await updateResp.json();

        if (!updateResp.ok) {
          return res.status(500).json({ error: updated.error?.message || 'erreur mise à jour votes' });
        }

        return res.status(200).json({ success: true, votes: updated.fields.Votes });
      }

      return res.status(400).json({ error: 'action inconnue' });
    }

    return res.status(405).json({ error: 'méthode non autorisée' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
