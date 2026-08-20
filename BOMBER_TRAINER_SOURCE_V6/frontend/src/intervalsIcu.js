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
      const key = String(activity?.id || `${activity?.start_date_local || ''}|${activity?.name || activity?.activity_name || ''}|${activity?.type || activity?.activity_type || ''}`);
      if (!seen.has(key)) { seen.add(key); all.push(activity); }
    }
    failedRanges.push(...result.failedRanges);
    if (i < chunks.length - 1) await sleep(500);
  }
  return { activities: all, failedRanges };
}

export async function getActivityStreams(activityId) { return request('streams', { id: activityId }); }

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const numericValue = (...values) => {
  const value = firstValue(...values);
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function durationSecondsValue(...values) {
  const value = firstValue(...values);
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  const text = String(value).trim();
  if (!text) return 0;
  if (text.includes(':')) {
    const parts = text.split(':').map(Number);
    if (parts.every(Number.isFinite)) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }
  }
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildWearable(activity, existingWearable = {}) {
  const activityId = firstValue(activity?.id, existingWearable?.activityId);
  const activityType = firstValue(activity?.type, activity?.activity_type, activity?.sport_type, existingWearable?.activityType);
  const name = firstValue(activity?.name, activity?.activity_name, activity?.title, existingWearable?.name);
  const startDateLocal = firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date, existingWearable?.startDateLocal);
  const durationSeconds = durationSecondsValue(activity?.moving_time, activity?.movingTime, activity?.elapsed_time, activity?.elapsedTime, activity?.duration, activity?.duration_seconds, existingWearable?.durationSeconds);
  const distanceMeters = numericValue(activity?.distance, activity?.distance_meters, activity?.distanceMeters, existingWearable?.distanceMeters);
  const distanceKm = numericValue(activity?.distance_km, activity?.distanceKm, existingWearable?.distanceKm);
  const averageHeartRate = numericValue(activity?.average_heartrate, activity?.averageHeartRate, activity?.average_hr, activity?.avg_hr, existingWearable?.heartRate?.average);
  const maxHeartRate = numericValue(activity?.max_heartrate, activity?.maxHeartRate, activity?.max_hr, existingWearable?.heartRate?.max);
  const minHeartRate = numericValue(activity?.min_heartrate, activity?.minHeartRate, activity?.min_hr, existingWearable?.heartRate?.min);
  const calories = numericValue(activity?.calories, existingWearable?.calories);
  const trainingLoad = numericValue(activity?.icu_training_load, activity?.training_load, activity?.trainingLoad, existingWearable?.trainingLoad);

  return {
    ...existingWearable,
    source: 'intervals.icu',
    activityId,
    activityType: activityType || null,
    name: name || null,
    startDateLocal: startDateLocal || null,
    durationSeconds,
    distanceMeters,
    distanceKm: distanceKm || null,
    heartRate: {
      ...(existingWearable?.heartRate || {}),
      average: averageHeartRate || null,
      max: maxHeartRate || null,
      min: minHeartRate || null,
    },
    calories: calories || null,
    trainingLoad: trainingLoad || null,
    streamTypes: firstValue(activity?.stream_types, activity?.streamTypes, existingWearable?.streamTypes) || [],
    syncedAt: new Date().toISOString(),
  };
}

function activityMatchKey(activity) {
  const id = String(activity?.id || '').trim();
  if (id) return `id:${id}`;
  const date = String(firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date) || '').slice(0, 16);
  const name = String(firstValue(activity?.name, activity?.activity_name, activity?.title) || '').trim().toLowerCase();
  const type = String(firstValue(activity?.type, activity?.activity_type, activity?.sport_type) || '').trim().toLowerCase();
  return `fallback:${date}|${name}|${type}`;
}

function wearableMatchKey(wearable, date) {
  const id = String(wearable?.activityId || '').trim();
  if (id) return `id:${id}`;
  const start = String(wearable?.startDateLocal || date || '').slice(0, 16);
  const name = String(wearable?.name || '').trim().toLowerCase();
  const type = String(wearable?.activityType || '').trim().toLowerCase();
  return `fallback:${start}|${name}|${type}`;
}

export async function syncRecentIntervalsActivities({ pb, owner, days = 3650, typeResolver, onProgress }) {
  const result = await getRecentIntervalsActivities(days, onProgress);
  const activities = result.activities || [];
  let imported = 0;
  let existing = 0;
  let skipped = 0;

  const existingRows = await pb.collection('bt_sessions').getFullList({ sort: '-created', filter: `owner = "${owner}"` });
  const knownRows = new Map();
  for (const row of existingRows) {
    const rawWearable = row?.wearable;
    const wearable = typeof rawWearable === 'string' ? (() => { try { return JSON.parse(rawWearable); } catch (_) { return {}; } })() : (rawWearable || {});
    if (wearable?.source === 'intervals.icu') knownRows.set(wearableMatchKey(wearable, row?.date), { row, wearable });
  }

  for (const activity of activities) {
    try {
      const date = String(firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date) || '').slice(0, 10);
      if (!date) { skipped += 1; continue; }
      const key = activityMatchKey(activity);
      const existingRecord = knownRows.get(key);
      const type = typeResolver?.(activity) || null;

      if (existingRecord) {
        // Repair previously imported records as well: older versions could save
        // durations such as "00:04:00" as zero because Number("00:04:00") is NaN.
        const wearable = buildWearable(activity, existingRecord.wearable);
        const patch = {
          date,
          duration: wearable.durationSeconds > 0 ? Math.round((wearable.durationSeconds / 60) * 10) / 10 : existingRecord.row.duration || 0,
          wearable,
        };
        if (type && existingRecord.row.type === 'manteniment') patch.type = type;
        await pb.collection('bt_sessions').update(existingRecord.row.id, patch);
        existing += 1;
        continue;
      }

      const wearable = buildWearable(activity);
      await pb.collection('bt_sessions').create({
        type: type || 'manteniment',
        date,
        duration: wearable.durationSeconds > 0 ? Math.round((wearable.durationSeconds / 60) * 10) / 10 : 0,
        points: 0,
        notes: 'Activitat sincronitzada des d’Intervals.icu · pendent d’associar',
        data: [],
        wearable,
        owner,
      });
      knownRows.set(key, { row: { id: null, date, duration: 0, type: type || 'manteniment' }, wearable });
      imported += 1;
    } catch (_) {
      skipped += 1;
    }
  }

  return {
    imported,
    updated: existing,
    existing,
    skipped,
    total: activities.length,
    failedRanges: result.failedRanges,
  };
}

export async function deleteAllIntervalsActivities({ pb, owner, onProgress }) {
  const rows = await pb.collection('bt_sessions').getFullList({ filter: `owner = "${owner}"` });
  const imported = rows.filter((row) => {
    const raw = row?.wearable;
    const wearable = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch (_) { return {}; } })() : (raw || {});
    return wearable?.source === 'intervals.icu';
  });
  for (let i = 0; i < imported.length; i += 1) {
    onProgress?.(`Esborrant activitats sincronitzades… ${i + 1}/${imported.length}`);
    await pb.collection('bt_sessions').delete(imported[i].id);
  }
  return imported.length;
}
