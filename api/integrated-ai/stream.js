export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta OPENAI_API_KEY a Vercel.' });
  try {
    const body = req.body || {};
    const message = Array.isArray(body.message)
      ? body.message.map((p) => p?.text || '').filter(Boolean).join('\n')
      : String(body.message || '');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5',
        instructions: 'Ets Bomber Trainer, un entrenador personal especialitzat en la preparació de proves de bombers de Catalunya. Respon en català si l’usuari escriu en català. Sigues pràctic, directe i personalitzat.',
        input: message,
        max_output_tokens: 900,
      }),
    });
    const raw = await response.text();
    if (!response.ok) {
      let error = raw;
      try { error = JSON.parse(raw)?.error?.message || error; } catch (_) {}
      return res.status(response.status).json({ error });
    }
    const data = JSON.parse(raw);
    const text = data?.output_text || data?.output?.flatMap((x) => x.content || []).filter((x) => x.type === 'output_text').map((x) => x.text).join('') || '';
    if (!text) return res.status(502).json({ error: 'La IA ha retornat una resposta buida.' });
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
