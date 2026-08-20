export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta GEMINI_API_KEY a Vercel.' });
  try {
    const body = req.body || {};
    const question = String(body.message || '');
    const history = Array.isArray(body.history) ? body.history.filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string').slice(-10) : [];
    const context = typeof body.context === 'string' ? body.context : '';
    const contents = [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: `${question}\n\n[CONTEXT BOMBER TRAINER]\n${context}` }] },
    ];
    const systemInstruction = { parts: [{ text: 'Ets Bomber Coach, entrenador personal especialitzat en la preparació de Bombers de Catalunya. Respon en català si l’usuari escriu en català. Analitza les dades reals proporcionades, sigues pràctic i directe, i NO inventis cap dada. La navette no està confirmada i no s’ha de tractar com una prova activa. Si una dada no existeix, digues-ho.' }] };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, contents, generationConfig: { temperature: 0.4, maxOutputTokens: 900 } }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText || 'Error connectant amb Gemini.';
      try { detail = JSON.parse(responseText)?.error?.message || detail; } catch (_) {}
      return res.status(response.status || 502).json({ error: detail });
    }
    const parsed = JSON.parse(responseText);
    const answer = parsed?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('').trim();
    if (!answer) return res.status(502).json({ error: 'Gemini ha retornat una resposta buida.' });
    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Error intern de Gemini.' });
  }
}
