const KEY_STORAGE = 'bt_intervals_icu_api_key';

export function getIntervalsApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setIntervalsApiKey(value) {
  const key = String(value || '').trim();
  if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(action, params = {}) {
  const key = getIntervalsApiKey();
  if (!key) throw new Error('Falta la clau API personal d’Intervals.icu.');
  // Never let the browser reuse a previous /api/intervals response. This is
  // important for repeated history syncs: a cached 304 must not be interpreted
  // as a failed Intervals response.
  const query = new URLSearchParams({ action, ...params, _ts: String(Date.now()) });
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`/api/intervals?${query.toString()}`, {
      headers: { 'x-intervals-api-key': key, 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
    if (response.ok) return data;
    lastError = new Error(data?.error || `Intervals.icu ha retornat ${response.status}.`);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw lastError;
    const retryAfter = Number(response.headers.get('retry-after') || 0);
    await sleep(Math.max(retryAfter * 1000, 1500 * (attempt + 1)));
  }
  throw lastError || new Error('No s’ha pogut contactar amb Intervals.icu.');
}

export async function testIntervalsConnection() {
  const data = await request('athlete');
  return { id: data?.id, name: data?.name || data?.firstname || 'Compte connectat' };
}

function dateChunks(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const chunks = [];
  let cursor = start;
  while (cursor <= end) {
    // Keep the number of API calls low enough to avoid rate limiting while still
    // staying comfortably below the activity endpoint's practical response size.
    const chunkEnd = new Date(Math.min(cursor.getTime() + (365 - 1) * 86400000, end.getTime()));
    chunks.push({ oldest: cursor.toISOString().slice(0, 10), newest: chunkEnd.toISOString().slice(0, 10) });
    cursor = new Date(chunkEnd.getTime() + 86400000);
  }
  return chunks;
}

export async function getRecentIntervalsActivities(days = 3650, onProgress) {
  const chunks = dateChunks(days);
  const all = [];
  const seen = new Set();
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(i + 1, chunks.length);
    const rows = await request('activities', chunks[i]);
    for (const activity of Array.isArray(rows) ? rows : []) {
      const key = String(activity?.id || `${activity?.start_date_local || ''}|${activity?.name || ''}`);
      if (!seen.has(key)) { seen.add(key); all.push(activity); }
    }
    if (i < chunks.length - 1) await sleep(500);
  }
  return all;
}

export async function getActivityStreams(activityId) { return request('streams', { id: activityId }); }

export async function syncRecentIntervalsActivities({ pb, owner, days = 3650, typeResolver, onProgress }) {
  const activities = await getRecentIntervalsActivities(days, onProgress);
  let imported = 0;
  for (const activity of activities || []) {
    const date = String(activity.start_date_local || '').slice(0, 10);
    if (!date) continue;
    const type = typeResolver(activity);
    const activityId = String(activity.id || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const existing = activityId ? await pb.collection('bt_sessions').getFullList({ filter: `owner = "${owner}" && wearable.activityId = "${activityId}"`, sort: '-created' }) : [];
    const wearable = { source: 'intervals.icu', activityId: activity.id, activityType: activity.type, name: activity.name || null, startDateLocal: activity.start_date_local, durationSeconds: Number(activity.moving_time || activity.elapsed_time || 0), distanceMeters: Number(activity.distance || 0), heartRate: { average: Number(activity.average_heartrate || 0) || null, max: Number(activity.max_heartrate || 0) || null, min: Number(activity.min_heartrate || 0) || null }, calories: Number(activity.calories || 0) || null, trainingLoad: Number(activity.icu_training_load || 0) || null, streamTypes: activity.stream_types || [], syncedAt: new Date().toISOString() };
    if (existing[0]) await pb.collection('bt_sessions').update(existing[0].id, { wearable, date });
    else await pb.collection('bt_sessions').create({ type: type || 'manteniment', date, duration: Math.round((wearable.durationSeconds / 60) * 10) / 10, points: 0, notes: 'Activitat sincronitzada des d’Intervals.icu · pendent d’associar', data: [], wearable, owner });
    imported += 1;
  }
  return { imported, total: Array.isArray(activities) ? activities.length : 0 };
}
