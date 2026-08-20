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

    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
          .slice(-12)
      : [];

    const input = [...history, { role: 'user', content: current }];
    const instructions = `Ets Bomber Trainer, un entrenador personal especialitzat en la preparació de proves de bombers de Catalunya. Respon en català si l'usuari escriu en català i en castellà si escriu en castellà. Sigues pràctic, directe i personalitzat. No inventis dades.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5', input, instructions, max_output_tokens: 900 }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText || 'Error connectant amb OpenAI.';
      try { detail = JSON.parse(responseText)?.error?.message || detail; } catch (_) {}
      res.status(response.status || 502).json({ error: detail });
      return;
    }

    let parsed;
    try { parsed = JSON.parse(responseText); } catch (_) {
      res.status(502).json({ error: 'Resposta d’OpenAI no vàlida.' });
      return;
    }

    const output = parsed?.output_text || (Array.isArray(parsed?.output)
      ? parsed.output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
          .filter((item) => item?.type === 'output_text' && typeof item?.text === 'string')
          .map((item) => item.text).join('')
      : '');

    if (!output) {
      res.status(502).json({ error: 'La IA ha retornat una resposta buida.' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ type: 'content', data: { content: output } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'completed', data: { content: '' } })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(500).json({ error: error?.message || 'Error intern de la IA.' });
    else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: { content: error?.message || 'Error intern de la IA.' } })}\n\n`);
      res.end();
    }
  }
}
