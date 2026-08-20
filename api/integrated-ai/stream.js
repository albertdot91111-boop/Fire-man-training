export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta OPENAI_API_KEY a Vercel.' });

  try {
    const body = req.body || {};
    const message = Array.isArray(body.message)
      ? body.message.map((p) => p?.text || '').filter(Boolean).join('\n')
      : String(body.message || '');

    const instructions = `Ets el Bomber Coach de BOMBER TRAINER, entrenador personal especialitzat en Bombers de Catalunya.
Respon en català si l'usuari escriu en català i en castellà si escriu en castellà.
Sigues pràctic, directe, motivador i personalitzat.
Utilitza les dades que l'usuari t'envia per analitzar sessions, marques, pesos, objectius, material i disponibilitat.
Si et pregunta com va, explica nivell, evolució, punts forts, punts febles i prioritat.
Si pregunta què millorar, prioritza el factor que més limita segons les dades.
Si pregunta què entrenar avui, proposa una sessió concreta adaptada al temps, material i historial.
Pots ajudar amb entrenament, planificació, proves físiques, estudi del temari i preguntes tipus oposició.
No inventis dades ni marques. Si falten dades, explica què falta.
La NAVETTE està actualment NO CONFIRMADA i NO és una prova activa: no l'incloguis en puntuacions, prioritats o plans com a prova oficial fins que l'usuari aporti bases oficials que la confirmin.
No presentis documents o suposades bases d'INF com a bases oficials definitives.
Si l'usuari diu simplement Hola, presenta't com el seu Bomber Coach i explica breument que pots analitzar el seu progrés, detectar punts febles, planificar entrenaments i ajudar-lo amb el temari.`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5', instructions, input: message, max_output_tokens: 1200 }),
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
    res.setHeader('Connection', 'keep-alive');
    res.write(`data: ${JSON.stringify({ type: 'content', data: { content: text } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'completed', data: { content: '' } })}\n\n`);
    res.end();
  } catch (error) {
    if (!res.headersSent) return res.status(500).json({ error: error?.message || 'Error intern de la IA.' });
    res.write(`data: ${JSON.stringify({ type: 'error', data: { content: error?.message || 'Error intern de la IA.' } })}\n\n`);
    res.end();
  }
}
