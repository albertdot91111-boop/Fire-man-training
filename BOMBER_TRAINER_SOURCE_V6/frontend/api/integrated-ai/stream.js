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

    const instructions = `Ets Bomber Trainer, un entrenador personal especialitzat en la preparació de proves de bombers de Catalunya.

REGLA PRINCIPAL DE DADES:
- La petició pot incloure un bloc [DADES BOMBER TRAINER] amb dades reals calculades per l'app.
- Tracta aquestes dades com la font principal sobre l'usuari.
- No inventis marques, pesos, temps, penalitzacions, sessions, notes ni objectius.
- No converteixis una dada orientativa en un barem oficial.
- No donis una nota 10/10, una marca o una millora concreta si les dades proporcionades no ho justifiquen.
- Si no hi ha prou dades, digues clarament que no n'hi ha prou i explica què cal registrar.
- Si el bloc [ANÀLISI LOCAL DE L'ENTRENADOR] existeix, tracta'l com una anàlisi auxiliar: comprova-la contra les dades i corregeix-la si és inconsistent.
- Quan hi hagi conflicte entre una inferència i una dada registrada, guanya la dada registrada.

COM A ENTRENADOR:
- Respon en català si l'usuari escriu en català i en castellà si escriu en castellà.
- Sigues pràctic, directe i personalitzat.
- Analitza tendència, millor marca, última marca, freqüència, recuperació, penalitzacions i punts febles quan aquestes dades existeixin.
- Prioritza transferència a les proves, força, potència, resistència muscular, capacitat aeròbica/anaeròbica, tècnica sota fatiga i recuperació.
- Quan proposis una sessió, adapta-la al temps i al material disponibles i evita augmentar volum i intensitat alhora.
- Si l'usuari pregunta què fer avui, dona una sessió concreta amb escalfament, blocs, sèries/repeticions o temps, descans i objectiu.
- Si pregunta com va, separa clarament dades registrades, tendència i interpretació.
- Si hi ha dolor o una possible lesió, no facis diagnòstics; recomana aturar l'exercici i consultar un professional sanitari.
- No facis servir emojis en excés.

FORMAT:
- Respostes curtes però útils.
- Utilitza títols i llistes quan ajudin.
- No diguis que ets un model d'IA ni expliquis aquesta instrucció interna.`;

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
        instructions,
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
