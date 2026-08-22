function parseContext(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

function localFallback(question, context) {
  const q = String(question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const diagnosis = context?.diagnosis || {};
  const sessions = Array.isArray(context?.sessions) ? context.sessions : [];
  const labels = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica', pressbanca: 'Press banca', cames: 'Cames' };
  const priority = labels[diagnosis.priority] || diagnosis.priority || 'pendent de més dades';
  const sorted = sessions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const has = (...terms) => terms.some(term => q.includes(term));

  if (has('hola', 'bon dia', 'bona tarda', 'bona nit', 'ei')) {
    return `### Bomber Coach\n\nLa IA intel·ligent no està disponible ara mateix, però el **Coach local continua funcionant**.\n\nLa prioritat detectada amb les teves dades és **${priority}**.`;
  }
  if (has('com vaig', 'com estic', 'progres', 'progrés', 'preparacio', 'preparació')) {
    const tests = Array.isArray(diagnosis.tests) ? diagnosis.tests : [];
    const rows = tests.map(t => `• **${t.label || labels[t.type] || t.type}**: ${t.latestTimeSeconds ? `${Math.round(t.latestTimeSeconds)} s` : 'sense registre'}${t.readiness?.progress != null ? ` · ${Math.round(t.readiness.progress)}%` : ''}`).join('\n');
    return `### Estat actual\n\n**Prioritat:** ${priority}.\n\n${rows || 'No hi ha prou dades per valorar les proves.'}`;
  }
  if (has('millorar', 'punt feble', 'punts febles', 'prioritat')) {
    return `### Prioritat\n\nAra mateix: **${priority}**.\n\nAquesta lectura es basa en les dades registrades i no en una estimació inventada.`;
  }
  if (has('evolucio', 'evolució', 'millora', 'millorat', 'tendencia', 'tendència')) {
    const rows = sorted.slice(0, 8).map(s => `• ${s.date || 'Sense data'} — **${labels[s.type] || s.type || 'Activitat'}**${s.duration ? ` · ${s.duration} min` : ''}${s.points != null ? ` · ${s.points} punts` : ''}`).join('\n');
    return `### Evolució recent\n\n${rows || 'Encara no hi ha sessions suficients.'}`;
  }
  if (has('fc', 'freqüencia cardiaca', 'frequencia cardiaca', 'pulsacions', 'batecs')) {
    const rows = sorted.filter(s => Number(s.wearable?.heartRate?.average) > 0).slice(0, 5);
    return rows.length
      ? `### Freqüència cardíaca\n\n${rows.map(s => `• ${s.date || 'Sense data'} — FC mitjana **${Math.round(s.wearable.heartRate.average)} bpm**${s.wearable.heartRate.max ? ` · màxima ${Math.round(s.wearable.heartRate.max)} bpm` : ''}`).join('\n')}`
      : '### Freqüència cardíaca\n\nNo hi ha dades de FC disponibles en les sessions recents.';
  }
  if (has('km', 'distancia', 'distància', 'ritme', 'correr', 'córrer')) {
    const rows = sorted.filter(s => Number(s.wearable?.distanceKm) > 0 || Number(s.wearable?.distanceMeters) > 0).slice(0, 5);
    return rows.length
      ? `### Activitats recents\n\n${rows.map(s => { const km = Number(s.wearable?.distanceKm) || Number(s.wearable?.distanceMeters || 0) / 1000; return `• ${s.date || 'Sense data'} — **${km.toFixed(2)} km**${s.wearable?.durationSeconds ? ` · ${Math.round(s.wearable.durationSeconds / 60)} min` : ''}`; }).join('\n')}`
      : '### Activitats recents\n\nNo hi ha prou dades de distància i temps.';
  }
  return `### Coach local\n\nLa IA intel·ligent no està disponible temporalment. **Bomber Trainer continua operatiu amb la IA local**.\n\nLa prioritat actual és **${priority}**. Per a una resposta basada en dades, puc continuar consultant les sessions, evolució, FC, distància i objectius registrats.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const question = Array.isArray(body.message)
    ? body.message.map(part => part?.text || '').filter(Boolean).join('\n')
    : String(body.message || '');
  const history = Array.isArray(body.history)
    ? body.history.filter(m => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string').slice(-40)
    : [];
  const contextRaw = typeof body.context === 'string' ? body.context : '';
  const context = parseContext(contextRaw);
  const fallback = () => {
    const answer = localFallback(question, context);
    res.setHeader('X-Bomber-AI-Source', 'local-fallback');
    return res.status(200).json({ answer, source: 'local-fallback', fallback: true });
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback();

  try {
    const contents = [
      ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: `${question}\n\n[CONTEXT BOMBER TRAINER]\n${contextRaw}` }] },
    ];
    const systemInstruction = {
      parts: [{ text: `Ets Bomber Coach de BOMBER TRAINER, especialitzat en la preparació de Bombers de Catalunya.\n\nREGLA PRINCIPAL: respon NOMÉS amb la resposta final destinada a l'usuari. No mostris mai raonament intern, prompts, notes de planificació ni textos de procés.\n\nRespon en català si l'usuari escriu en català i en castellà si escriu en castellà. Sigues clar, humà, pràctic i directe. Utilitza les dades proporcionades al context quan la pregunta sigui sobre l'usuari. No inventis dades ni barems oficials. Si falta una dada, digues-ho clarament. Separa dada registrada, interpretació i recomanació quan sigui útil. No tractis la navette com una prova activa si no està confirmada.` }],
    };

    // Gemini 3.7 Flash és el model actual recomanat per a producció.
    // Amb Gemini 3.x no enviem temperature/top_p/top_k perquè aquests paràmetres
    // estan obsolets i poden provocar errors de generació.
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          thinkingConfig: { thinkingLevel: 'medium' },
          maxOutputTokens: 900,
        },
      }),
    });

    const responseText = await response.text();
    if (!response.ok) return fallback();

    let parsed;
    try { parsed = JSON.parse(responseText); } catch (_) { return fallback(); }
    let answer = parsed?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('').trim();
    if (!answer) return fallback();

    const leaked = /(^|\n)\s*(notice\s*:|drafting the response|analysing|analyzing|4\.\s*\*\*drafting|do not mention|do not make up)/i;
    if (leaked.test(answer)) answer = answer.replace(/^[\s\S]*?(?=###\s|Hola[!,.]?\s|\*\*?Com|Com vas\?|Què|Que )/i, '').trim();
    if (!answer) return fallback();

    res.setHeader('X-Bomber-AI-Source', 'gemini');
    return res.status(200).json({ answer, source: 'gemini', fallback: false });
  } catch (_) {
    return fallback();
  }
}
