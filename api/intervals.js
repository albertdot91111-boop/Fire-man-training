function basicAuth(apiKey) {
  return `Basic ${Buffer.from(`API_KEY:${apiKey}`).toString('base64')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = String(req.headers['x-intervals-api-key'] || '').trim();
  if (!apiKey) return res.status(401).json({ error: 'Falta la clau API d’Intervals.icu.' });

  const action = String(req.query?.action || 'athlete');
  let path = '/api/v1/athlete/0';
  if (action === 'activities') {
    const oldest = String(req.query?.oldest || '');
    const newest = String(req.query?.newest || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(oldest) || !/^\d{4}-\d{2}-\d{2}$/.test(newest)) {
      return res.status(400).json({ error: 'Dates oldest/newest no vàlides.' });
    }
    path = `/api/v1/athlete/0/activities?oldest=${encodeURIComponent(oldest)}&newest=${encodeURIComponent(newest)}`;
  } else if (action === 'streams') {
    const id = String(req.query?.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Falta activity id.' });
    path = `/api/v1/activity/${encodeURIComponent(id)}/streams.json?types=heartrate,time,distance,velocity_smooth,altitude`;
  }

  try {
    const response = await fetch(`https://intervals.icu${path}`, {
      headers: { Authorization: basicAuth(apiKey), Accept: 'application/json' },
    });
    const text = await response.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { raw: text }; }
    return res.status(response.status).json(body);
  } catch (error) {
    return res.status(502).json({ error: error?.message || 'No s’ha pogut contactar amb Intervals.icu.' });
  }
}
