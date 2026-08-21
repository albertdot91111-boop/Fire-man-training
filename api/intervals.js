function basicAuth(apiKey) {
  return `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIntervals(path, apiKey) {
  // Keep upstream retries deliberately small. The browser also has a retry
  // layer, so 4x4 retries could multiply into a request storm.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const freshPath = `${path}${separator}_bt=${Date.now()}_${attempt}`;
    const response = await fetch(`https://intervals.icu${freshPath}`, {
      headers: { Authorization: basicAuth(apiKey), Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      cache: 'no-store', redirect: 'follow',
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
    if (response.status === 304) {
      if (attempt === 0) { await sleep(1200); continue; }
      const error = new Error('Intervals.icu ha retornat 304 repetidament per a aquesta consulta.'); error.status = 502; throw error;
    }
    if (!response.ok) {
      let detail = body?.error || body?.message || body?.raw || `Intervals.icu ha retornat ${response.status}.`;
      if (response.status === 401) detail = 'Clau API d’Intervals.icu no autoritzada (401). Comprova que has enganxat la clau personal exacta de Developer Settings.';
      if (response.status === 403) detail = 'Intervals.icu ha rebutjat l’accés (403). La clau és incorrecta, està revocada o no té el format esperat.';
      const error = new Error(String(detail)); error.status = response.status;
      // Never retry a provider rate limit or an auth/configuration error.
      if (response.status === 429 || response.status === 401 || response.status === 403 || attempt === 1) throw error;
      await sleep(1200);
      continue;
    }
    return body;
  }
  const error = new Error('No s’ha pogut contactar amb Intervals.icu.'); error.status = 502; throw error;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Vary', 'x-intervals-api-key');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = String(req.headers['x-intervals-api-key'] || '').trim();
  if (!apiKey) return res.status(401).json({ error: 'Falta la clau API d’Intervals.icu.' });
  const action = String(req.query?.action || 'athlete');
  try {
    if (action === 'athlete') return res.status(200).json(await fetchIntervals('/api/v1/athlete/0', apiKey));
    if (action === 'activities') {
      const oldest = String(req.query?.oldest || ''), newest = String(req.query?.newest || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(oldest) || !/^\d{4}-\d{2}-\d{2}$/.test(newest)) return res.status(400).json({ error: 'Dates oldest/newest no vàlides.' });
      const path = `/api/v1/athlete/0/activities?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}&limit=5000`;
      const rows = await fetchIntervals(path, apiKey); return res.status(200).json(Array.isArray(rows) ? rows : []);
    }
    if (action === 'activity') {
      const id = String(req.query?.id || '').trim(); if (!id) return res.status(400).json({ error: 'Falta activity id.' });
      return res.status(200).json(await fetchIntervals(`/api/v1/activity/${encodeURIComponent(id)}?intervals=false`, apiKey));
    }
    if (action === 'streams') {
      const id = String(req.query?.id || '').trim(); if (!id) return res.status(400).json({ error: 'Falta activity id.' });
      return res.status(200).json(await fetchIntervals(`/api/v1/activity/${encodeURIComponent(id)}/streams.json?types=heartrate,time,distance,velocity_smooth,altitude`, apiKey));
    }
    return res.status(400).json({ error: 'Acció d’Intervals.icu no reconeguda.' });
  } catch (error) {
    const status = Number(error?.status);
    return res.status(status >= 400 && status < 600 && status !== 304 ? status : 502).json({ error: error?.message || 'No s’ha pogut contactar amb Intervals.icu.' });
  }
}
