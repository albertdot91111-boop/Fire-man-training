function basicAuth(apiKey) {
  return `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;
}

function dateChunks(startDate, endDate, chunkDays = 180) {
  const chunks = [];
  let cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const chunkEnd = new Date(cursor.getTime() + (chunkDays - 1) * 86400000);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push({
      oldest: cursor.toISOString().slice(0, 10),
      newest: chunkEnd.toISOString().slice(0, 10),
    });
    cursor = new Date(chunkEnd.getTime() + 86400000);
  }
  return chunks;
}

async function fetchIntervals(path, apiKey) {
  const response = await fetch(`https://intervals.icu${path}`, {
    headers: { Authorization: basicAuth(apiKey), Accept: 'application/json' },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
  if (!response.ok) {
    const detail = body?.error || body?.message || body?.raw || `Intervals.icu ha retornat ${response.status}.`;
    const error = new Error(String(detail));
    error.status = response.status;
    throw error;
  }
  return body;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = String(req.headers['x-intervals-api-key'] || '').trim();
  if (!apiKey) return res.status(401).json({ error: 'Falta la clau API d’Intervals.icu.' });

  const action = String(req.query?.action || 'athlete');

  try {
    if (action === 'athlete') {
      const data = await fetchIntervals('/api/v1/athlete/0', apiKey);
      return res.status(200).json(data);
    }

    if (action === 'activities') {
      const oldest = String(req.query?.oldest || '');
      const newest = String(req.query?.newest || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(oldest) || !/^\d{4}-\d{2}-\d{2}$/.test(newest)) {
        return res.status(400).json({ error: 'Dates oldest/newest no vàlides.' });
      }
      const chunks = dateChunks(oldest, newest, 180);
      const all = [];
      const seen = new Set();
      for (const chunk of chunks) {
        const path = `/api/v1/athlete/0/activities?oldest=${encodeURIComponent(chunk.oldest)}&newest=${encodeURIComponent(chunk.newest)}&limit=5000`;
        const rows = await fetchIntervals(path, apiKey);
        for (const activity of Array.isArray(rows) ? rows : []) {
          const key = String(activity?.id || `${activity?.start_date_local || ''}|${activity?.name || ''}`);
          if (!seen.has(key)) { seen.add(key); all.push(activity); }
        }
      }
      return res.status(200).json(all);
    }

    if (action === 'streams') {
      const id = String(req.query?.id || '').trim();
      if (!id) return res.status(400).json({ error: 'Falta activity id.' });
      const path = `/api/v1/activity/${encodeURIComponent(id)}/streams.json?types=heartrate,time,distance,velocity_smooth,altitude`;
      const data = await fetchIntervals(path, apiKey);
      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Acció d’Intervals.icu no reconeguda.' });
  } catch (error) {
    return res.status(Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 502).json({ error: error?.message || 'No s’ha pogut contactar amb Intervals.icu.' });
  }
}
