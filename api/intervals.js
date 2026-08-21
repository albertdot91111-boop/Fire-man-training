function basicAuth(apiKey) {
  return `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchIntervals(path, apiKey) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const freshPath = `${path}${separator}_bt=${Date.now()}_${attempt}`;
    const response = await fetch(`https://intervals.icu${freshPath}`, {
      headers: {
        Authorization: basicAuth(apiKey),
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }

    if (response.status === 304) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!response.ok) {
      const detail = body?.error || body?.message || body?.raw || `Intervals.icu ha retornat ${response.status}.`;
      const error = new Error(String(detail));
      error.status = response.status;
      throw error;
    }
    return body;
  }

  const error = new Error('Intervals.icu ha retornat 304 repetidament per a aquesta consulta.');
  error.status = 502;
  throw error;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  res.setHeader('Vary', 'x-intervals-api-key');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = String(req.headers['x-intervals-api-key'] || '').trim();
  if (!apiKey) return res.status(401).json({ error: 'Falta la clau API d’Intervals.icu.' });

  const action = String(req.query?.action || 'athlete');
  try {
    if (action === 'athlete') {
      return res.status(200).json(await fetchIntervals('/api/v1/athlete/0', apiKey));
    }

    if (action === 'activities') {
      const oldest = String(req.query?.oldest || '');
      const newest = String(req.query?.newest || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(oldest) || !/^\d{4}-\d{2}-\d{2}$/.test(newest)) {
        return res.status(400).json({ error: 'Dates oldest/newest no vàlides.' });
      }
      const fields = [
        'id','name','type','start_date_local','start_date','distance','icu_distance','moving_time','elapsed_time',
        'average_speed','average_heartrate','max_heartrate','min_heartrate','calories',
        'icu_training_load','stream_types','sub_type','source'
      ].join(',');
      const path = `/api/v1/athlete/0/activities?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}&limit=5000&fields=${encodeURIComponent(fields)}`;
      const rows = await fetchIntervals(path, apiKey);
      return res.status(200).json(Array.isArray(rows) ? rows : []);
    }

    if (action === 'activity') {
      const id = String(req.query?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Falta activity id.' });
      return res.status(200).json(await fetchIntervals(`/api/v1/activity/${encodeURIComponent(id)}?intervals=false`, apiKey));
    }

    if (action === 'streams') {
      const id = String(req.query?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Falta activity id.' });
      const path = `/api/v1/activity/${encodeURIComponent(id)}/streams.json?types=heartrate,time,distance,velocity_smooth,altitude`;
      return res.status(200).json(await fetchIntervals(path, apiKey));
    }

    return res.status(400).json({ error: 'Acció d’Intervals.icu no reconeguda.' });
  } catch (error) {
    const status = Number(error?.status);
    return res.status(status >= 400 && status < 600 && status !== 304 ? status : 502).json({ error: error?.message || 'No s’ha pogut contactar amb Intervals.icu.' });
  }
}
