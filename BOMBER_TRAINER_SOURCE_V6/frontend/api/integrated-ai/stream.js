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

    const input = [
      ...history,
      { role: 'user', content: current },
    ];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        stream: true,
        input,
        instructions: `Ets Bomber Trainer, un entrenador personal especialitzat en la preparació de proves de bombers de Catalunya. Respon en català si l'usuari escriu en català i en castellà si escriu en castellà. Sigues pràctic, directe i honest. No inventis marques, resultats ni dades de l'usuari. Quan faltin dades, demana-les. Prioritza força, resistència, tècnica, recuperació i especificitat de les proves de bomber. No substitueixis un professional sanitari en cas de dolor o lesió.`,
        max_output_tokens: 900,
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text();
      res.status(response.status || 502).json({ error: detail || 'Error connectant amb OpenAI.' });
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const send = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'response.output_text.delta' && parsed.delta) {
              send({ type: 'content', data: { content: parsed.delta } });
            }
            if (parsed.type === 'response.failed') {
              send({ type: 'error', data: { content: 'La IA ha fallat durant la resposta.' } });
            }
          } catch (_) {}
        }
      }
    }

    send({ type: 'completed', data: { content: '' } });
    res.end();
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'Error intern de la IA.' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: { content: error?.message || 'Error intern de la IA.' } })}\n\n`);
      res.end();
    }
  }
}
