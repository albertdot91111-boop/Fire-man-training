export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta OPENAI_API_KEY a Vercel.' });
    return;
  }

  try {
    const body = req.body || {};
    const current = Array.isArray(body.message)
      ? body.message.map((part) => part?.text || '').filter(Boolean).join('\n')
      : String(body.message || '');

    if (!current.trim()) {
      res.status(400).json({ error: 'No s’ha rebut cap pregunta.' });
      return;
    }

    const history = Array.isArray(body.history)
      ? body.history.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string').slice(-12)
      : [];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5',
        instructions: 'Ets Bomber Trainer, un entrenador personal especialitzat en la preparació de proves de bombers de Catalunya. Respon en català si l’usuari escriu en català i en castellà si escriu en castellà. Respon qualsevol pregunta relacionada amb entrenament, oposicions, proves físiques o preparació. Sigues pràctic, directe i personalitzat. No inventis dades.',
        input: [...history, { role: 'user', content: current }],
        max_output_tokens: 900,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      let message = raw || 'Error connectant amb OpenAI.';
      try { message = JSON.parse(raw)?.error?.message || message; } catch (_) {}
      res.status(response.status || 502).json({ error: message });
      return;
    }

    let data;
    try { data = JSON.parse(raw); } catch (_) {
      res.status(502).json({ error: 'Resposta de la IA no vàlida.' });
      return;
    }

    const text = data?.output_text || '';
    if (!text) {
      res.status(502).json({ error: 'La IA ha retornat una resposta buida.' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.write(`data: ${JSON.stringify({ type: 'content', data: { content: text } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'completed', data: { content: '' } })}\n\n`);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Error intern de la IA.' });
  }
}
