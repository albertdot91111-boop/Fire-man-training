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
    const chunkEnd = new Date(Math.min(cursor.getTime() + (365 - 1) * 86400000, end.getTime()));
    chunks.push({ oldest: cursor.toISOString().slice(0, 10), newest: chunkEnd.toISOString().slice(0, 10) });
    cursor = new Date(chunkEnd.getTime() + 86400000);
  }
  return chunks;
}

async function fetchChunkResilient(chunk, onProgress, label = '') {
  try {
    return { rows: await request('activities', chunk), failedRanges: [] };
  } catch (error) {
    // A single problematic historical range must never abort the whole 10-year
    // import. Split it until it is small enough to identify/skip only the bad
    // range. This also protects against intermittent upstream 5xx/304 responses.
    const from = new Date(`${chunk.oldest}T00:00:00Z`).getTime();
    const to = new Date(`${chunk.newest}T00:00:00Z`).getTime();
    const days = Math.round((to - from) / 86400000) + 1;
    if (days <= 31) return { rows: [], failedRanges: [{ ...chunk, error: error?.message || 'Error desconegut' }] };
    const middle = new Date(from + Math.floor((days - 1) / 2) * 86400000);
    const left = { oldest: chunk.oldest, newest: middle.toISOString().slice(0, 10) };
    const rightStart = new Date(middle.getTime() + 86400000);
    const right = { oldest: rightStart.toISOString().slice(0, 10), newest: chunk.newest };
    onProgress?.(label ? `${label}: reintentant rang petit` : 'Reintentant rang petit');
    const [a, b] = await Promise.all([
      fetchChunkResilient(left, onProgress, label),
      fetchChunkResilient(right, onProgress, label),
    ]);
    return { rows: [...(Array.isArray(a.rows) ? a.rows : []), ...(Array.isArray(b.rows) ? b.rows : [])], failedRanges: [...a.failedRanges, ...b.failedRanges] };
  }
}

export async function getRecentIntervalsActivities(days = 3650, onProgress) {
  const chunks = dateChunks(days);
  const all = [];
  const seen = new Set();
  const failedRanges = [];
  for (let i = 0; i < chunks.length; i += 1) {
    onProgress?.(`Sincronitzant historial… bloc ${i + 1}/${chunks.length}`);
    const result = await fetchChunkResilient(chunks[i], onProgress, `bloc ${i + 1}/${chunks.length}`);
    for (const activity of Array.isArray(result.rows) ? result.rows : []) {
      const key = String(activity?.id || `${activity?.start_date_local || ''}|${activity?.name || ''}`);
      if (!seen.has(key)) { seen.add(key); all.push(activity); }
    }
    failedRanges.push(...result.failedRanges);
    if (i < chunks.length - 1) await sleep(500);
  }
  return { activities: all, failedRanges };
}

export async function getActivityStreams(activityId) { return request('streams', { id: activityId }); }

export async function syncRecentIntervalsActivities({ pb, owner, days = 3650, typeResolver, onProgress }) {
  const result = await getRecentIntervalsActivities(days, onProgress);
  const activities = result.activities || [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  // Do one owner-scoped read instead of filtering on nested JSON fields. The
  // latter is fragile in PocketBase and was the reason the sync could stop
  // after several blocks with a generic "Something went wrong" message.
  const existingRows = await pb.collection('bt_sessions').getFullList({ sort: '-created', filter: `owner = "${owner}"` });
  const byActivityId = new Map();
  for (const row of existingRows) {
    const id = row?.wearable?.source === 'intervals.icu' ? String(row?.wearable?.activityId || '') : '';
    if (id && !byActivityId.has(id)) byActivityId.set(id, row);
  }

  for (const activity of activities) {
    try {
      const date = String(activity?.start_date_local || '').slice(0, 10);
      if (!date) { skipped += 1; continue; }
      const type = typeResolver?.(activity) || null;
      const activityId = String(activity?.id || '');
      const wearable = {
        source: 'intervals.icu',
        activityId: activity?.id,
        activityType: activity?.type,
        name: activity?.name || null,
        startDateLocal: activity?.start_date_local,
        durationSeconds: Number(activity?.moving_time || activity?.elapsed_time || 0),
        distanceMeters: Number(activity?.distance || 0),
        heartRate: {
          average: Number(activity?.average_heartrate || 0) || null,
          max: Number(activity?.max_heartrate || 0) || null,
          min: Number(activity?.min_heartrate || 0) || null,
        },
        calories: Number(activity?.calories || 0) || null,
        trainingLoad: Number(activity?.icu_training_load || 0) || null,
        streamTypes: activity?.stream_types || [],
        syncedAt: new Date().toISOString(),
      };
      const existing = activityId ? byActivityId.get(activityId) : null;
      if (existing) {
        await pb.collection('bt_sessions').update(existing.id, { wearable, date });
        updated += 1;
      } else {
        const created = await pb.collection('bt_sessions').create({
          type: type || 'manteniment',
          date,
          duration: Math.round((wearable.durationSeconds / 60) * 10) / 10,
          points: 0,
          notes: 'Activitat sincronitzada des d’Intervals.icu · pendent d’associar',
          data: [],
          wearable,
          owner,
        });
        if (activityId) byActivityId.set(activityId, created);
        imported += 1;
      }
    } catch (_) {
      // One malformed activity must not prevent the rest of the history from
      // being imported. It remains available in Intervals.icu for inspection.
      skipped += 1;
    }
  }

  return {
    imported,
    updated,
    skipped,
    total: activities.length,
    failedRanges: result.failedRanges,
  };
}
