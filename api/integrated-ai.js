export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta OPENAI_API_KEY a Vercel.' });
  try {
    const body = req.body || {};
    const current = Array.isArray(body.message)
      ? body.message.map(p => p?.text || '').filter(Boolean).join('\n')
      : String(body.message || '');
    if (!current.trim()) return res.status(400).json({ error: 'No s’ha rebut cap pregunta.' });
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const instructions = `Ets BOMBER COACH, l'entrenador personal de l'usuari dins Bomber Trainer. No ets un xat genèric. La teva funció és analitzar les dades d'entrenament que l'app et proporciona, detectar punts febles, explicar l'evolució, proposar què entrenar avui, adaptar setmanes i respondre dubtes sobre la preparació de Bombers de Catalunya. Sigues pràctic, directe i personalitzat. Utilitza les dades reals que reps i no inventis marques ni sessions. Si falten dades, digues-ho. La navette NO està confirmada com a prova activa i no l'has d'utilitzar en càlculs ni recomanacions com si fos oficial. Si l'usuari diu Hola, saluda'l i explica breument què pots fer com a Bomber Coach. Respon en català si l'usuari escriu en català i en castellà si escriu en castellà.`;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5', instructions, input: [...history, { role: 'user', content: current }], max_output_tokens: 1200 })
    });
    const raw = await response.text();
    if (!response.ok) {
      let message = raw || 'Error connectant amb OpenAI.';
      try { message = JSON.parse(raw)?.error?.message || message; } catch (_) {}
      return res.status(response.status || 502).json({ error: message });
    }
    const data = JSON.parse(raw);
    const text = data?.output_text || '';
    if (!text) return res.status(502).json({ error: 'La IA ha retornat una resposta buida.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.write(`data: ${JSON.stringify({ type: 'content', data: { content: text } })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'completed', data: { content: '' } })}\n\n`);
    res.end();
  } catch (error) { return res.status(500).json({ error: error?.message || 'Error intern de la IA.' }); }
}
