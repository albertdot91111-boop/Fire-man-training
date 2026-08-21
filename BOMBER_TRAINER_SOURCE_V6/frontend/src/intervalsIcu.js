// Intervals.icu client + sincronització.
//
// FIX 2026-08-21 — problema real detectat:
// 1. `buildWearable` acceptava un `activity?.duration` genèric i un fallback
//    `existingWearable?.durationSeconds` que preservava valors incorrectes de
//    sincronitzacions antigues. Això generava temps "inventats" de 4:00 o 5:00
//    (que en realitat provenien d'anteriors bugs guardats a la base de dades).
// 2. La deduplicació ignorava qualsevol row existent que no tingués
//    `wearable.source === 'intervals.icu'`. Això feia que sessions manuals o
//    Suunto del mateix dia no s'associessin amb l'activitat d'Intervals.icu i
//    cada sincronització creés un DUPLICAT.
// 3. La coerció d'IDs no era del tot estable entre número i string.
//
// A partir d'ara, per la durada d'una activitat d'Intervals.icu, només ens
// fiem de `moving_time` i `elapsed_time` (segons, integer, segons docs oficials).
// Si l'API no ho retorna, la durada queda `null` i la UI mostra "—".
// No inventem cap valor.

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
      const id = String(activity?.id ?? '').trim();
      const fallback = `${activity?.start_date_local || ''}|${activity?.name || ''}|${activity?.type || ''}`;
      const key = id ? `id:${id}` : `fb:${fallback}`;
      if (!seen.has(key)) { seen.add(key); all.push(activity); }
    }
    failedRanges.push(...result.failedRanges);
    if (i < chunks.length - 1) await sleep(500);
  }
  return { activities: all, failedRanges };
}

export async function getActivityStreams(activityId) { return request('streams', { id: activityId }); }

// ---- MAPPING helpers (only strict, no invented values) --------------------

const firstValue = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');

function positiveNumber(...values) {
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractDurationSeconds(activity) {
  const moving = positiveNumber(activity?.moving_time, activity?.movingTime);
  if (moving) return moving;
  const elapsed = positiveNumber(activity?.elapsed_time, activity?.elapsedTime);
  if (elapsed) return elapsed;
  return null;
}

function extractDistanceMeters(activity) {
  return positiveNumber(activity?.icu_distance, activity?.distance, activity?.distance_meters, activity?.distanceMeters);
}

function buildWearable(activity, existingWearable = {}) {
  const rawId = firstValue(activity?.id, existingWearable?.activityId);
  const activityId = rawId === undefined || rawId === null ? null : String(rawId).trim() || null;
  const activityType = firstValue(activity?.type, activity?.activity_type, activity?.sport_type, existingWearable?.activityType);
  const name = firstValue(activity?.name, activity?.activity_name, activity?.title, existingWearable?.name);
  const startDateLocal = firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date, existingWearable?.startDateLocal);
  const durationSeconds = extractDurationSeconds(activity);
  const distanceMeters = extractDistanceMeters(activity);
  const distanceKm = distanceMeters ? distanceMeters / 1000 : null;
  const averageHeartRate = positiveNumber(activity?.average_heartrate, activity?.averageHeartRate, activity?.average_hr, activity?.avg_hr);
  const maxHeartRate = positiveNumber(activity?.max_heartrate, activity?.maxHeartRate, activity?.max_hr);
  const minHeartRate = positiveNumber(activity?.min_heartrate, activity?.minHeartRate, activity?.min_hr);
  const calories = positiveNumber(activity?.calories);
  const trainingLoad = positiveNumber(activity?.icu_training_load, activity?.training_load, activity?.trainingLoad, activity?.hr_load, activity?.power_load, activity?.pace_load);
  const averageSpeed = positiveNumber(activity?.average_speed, activity?.averageSpeed);
  return {
    ...existingWearable,
    source: 'intervals.icu',
    activityId,
    activityType: activityType || null,
    name: name || null,
    startDateLocal: startDateLocal || null,
    durationSeconds: durationSeconds || null,
    distanceMeters: distanceMeters || null,
    distanceKm,
    icuDistanceMeters: positiveNumber(activity?.icu_distance),
    averageSpeed,
    heartRate: { ...(existingWearable?.heartRate || {}), average: averageHeartRate, max: maxHeartRate, min: minHeartRate },
    calories,
    trainingLoad,
    streamTypes: firstValue(activity?.stream_types, activity?.streamTypes, existingWearable?.streamTypes) || [],
    syncedAt: new Date().toISOString(),
  };
}

function activityDateKey(activity) {
  return String(firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date) || '').slice(0, 10);
}

function activityIdKey(activity) {
  const id = activity?.id === undefined || activity?.id === null ? '' : String(activity.id).trim();
  return id || null;
}

function activityFallbackKey(activity) {
  const date = String(firstValue(activity?.start_date_local, activity?.startDateLocal, activity?.start_date) || '').slice(0, 16);
  const name = String(firstValue(activity?.name, activity?.activity_name, activity?.title) || '').trim().toLowerCase();
  const type = String(firstValue(activity?.type, activity?.activity_type, activity?.sport_type) || '').trim().toLowerCase();
  return `${date}|${name}|${type}`;
}

function wearableIdKey(wearable) {
  const id = wearable?.activityId === undefined || wearable?.activityId === null ? '' : String(wearable.activityId).trim();
  return id || null;
}

function wearableFallbackKey(wearable, date) {
  const start = String(wearable?.startDateLocal || date || '').slice(0, 16);
  const name = String(wearable?.name || '').trim().toLowerCase();
  const type = String(wearable?.activityType || '').trim().toLowerCase();
  return `${start}|${name}|${type}`;
}

function parseWearable(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw) || {}; } catch (_) { return {}; } }
  return raw || {};
}

export async function syncRecentIntervalsActivities({ pb, owner, days = 3650, typeResolver, onProgress }) {
  const result = await getRecentIntervalsActivities(days, onProgress);
  const activities = result.activities || [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const existingRows = await pb.collection('bt_sessions').getFullList({ sort: '-created', filter: `owner = "${owner}"` });
  const byId = new Map();
  const rowsByDate = new Map();
  for (const row of existingRows) {
    const wearable = parseWearable(row?.wearable);
    const sourced = wearable?.source === 'intervals.icu';
    const record = { row, wearable, sourced };
    if (sourced) {
      const idKey = wearableIdKey(wearable);
      if (idKey) byId.set(idKey, record);
    }
    const dateKey = String(row?.date || wearable?.startDateLocal || '').slice(0, 10);
    if (dateKey) {
      const list = rowsByDate.get(dateKey) || [];
      list.push(record);
      rowsByDate.set(dateKey, list);
    }
  }
  const consumed = new Set();
  for (const activity of activities) {
    try {
      const date = activityDateKey(activity);
      if (!date) { skipped += 1; continue; }
      const idKey = activityIdKey(activity);
      const fbKey = activityFallbackKey(activity);
      let existingRecord = null;
      if (idKey && byId.has(idKey)) existingRecord = byId.get(idKey);
      if (!existingRecord) {
        const candidates = (rowsByDate.get(date) || []).filter((r) => !consumed.has(r.row.id));
        existingRecord = candidates.find((r) => r.sourced && !wearableIdKey(r.wearable)) || null;
        if (!existingRecord) existingRecord = candidates.find((r) => wearableFallbackKey(r.wearable, r.row?.date) === fbKey) || null;
        if (!existingRecord && candidates.length === 1 && !candidates[0].sourced) existingRecord = candidates[0];
      }
      const suggestedType = typeResolver?.(activity) || null;
      if (existingRecord) {
        consumed.add(existingRecord.row.id);
        const wearable = buildWearable(activity, existingRecord.wearable);
        if (idKey) byId.set(idKey, { row: existingRecord.row, wearable, sourced: true });
        const patch = { date, wearable };
        if (wearable.durationSeconds) patch.duration = Math.round((wearable.durationSeconds / 60) * 10) / 10;
        if (suggestedType && existingRecord.row.type === 'manteniment') patch.type = suggestedType;
        await pb.collection('bt_sessions').update(existingRecord.row.id, patch);
        updated += 1;
        continue;
      }
      const wearable = buildWearable(activity);
      const created = await pb.collection('bt_sessions').create({
        type: suggestedType || 'manteniment', date,
        duration: wearable.durationSeconds ? Math.round((wearable.durationSeconds / 60) * 10) / 10 : 0,
        points: 0,
        notes: 'Activitat sincronitzada des d’Intervals.icu · pendent d’associar',
        data: [], wearable, owner,
      });
      const record = { row: created, wearable, sourced: true };
      consumed.add(created.id);
      if (idKey) byId.set(idKey, record);
      const list = rowsByDate.get(date) || [];
      list.push(record);
      rowsByDate.set(date, list);
      imported += 1;
    } catch (error) {
      skipped += 1;
      console.warn('[intervalsIcu] skip', activity?.id, error?.message || error);
    }
  }
  return { imported, updated, existing: updated, skipped, total: activities.length, failedRanges: result.failedRanges };
}

export async function deleteAllIntervalsActivities({ pb, owner, onProgress }) {
  const rows = await pb.collection('bt_sessions').getFullList({ filter: `owner = "${owner}"` });
  const imported = rows.filter((row) => parseWearable(row?.wearable)?.source === 'intervals.icu');
  for (let i = 0; i < imported.length; i += 1) {
    onProgress?.(`Esborrant activitats sincronitzades… ${i + 1}/${imported.length}`);
    await pb.collection('bt_sessions').delete(imported[i].id);
  }
  return imported.length;
}

export const __test__ = { buildWearable, extractDurationSeconds, extractDistanceMeters };