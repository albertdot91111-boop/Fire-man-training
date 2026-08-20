export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta GEMINI_API_KEY a Vercel.' });
    return;
  }

  try {
    const body = req.body || {};
    const question = Array.isArray(body.message)
      ? body.message.map((part) => part?.text || '').filter(Boolean).join('\n')
      : String(body.message || '');

    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
          .slice(-10)
      : [];

    const context = typeof body.context === 'string' ? body.context : '';
    const contents = [
      ...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: `${question}\n\n[CONTEXT BOMBER TRAINER]\n${context}` }] },
    ];

    const systemInstruction = {
      parts: [{ text: 'Ets Bomber Coach, entrenador personal especialitzat en la preparació de Bombers de Catalunya. Respon en català si l’usuari escriu en català. Analitza les dades reals proporcionades, sigues pràctic i directe, i NO inventis cap dada. Si una dada no existeix, digues-ho. No facis servir cap prova que no estigui confirmada dins de les dades proporcionades.' }],
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction, contents, generationConfig: { temperature: 0.4, maxOutputTokens: 900 } }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText || 'Error connectant amb Gemini.';
      try { detail = JSON.parse(responseText)?.error?.message || detail; } catch (_) {}
      res.status(response.status || 502).json({ error: detail });
      return;
    }

    const parsed = JSON.parse(responseText);
    const answer = parsed?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('').trim();
    if (!answer) {
      res.status(502).json({ error: 'Gemini ha retornat una resposta buida.' });
      return;
    }
    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Error intern de Gemini.' });
  }
}
