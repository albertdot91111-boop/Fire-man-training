const KEY_STORAGE = 'bt_intervals_icu_api_key';

export function getIntervalsApiKey() { return localStorage.getItem(KEY_STORAGE) || ''; }
export function setIntervalsApiKey(value) {
  const key = String(value || '').trim();
  if (key) localStorage.setItem(KEY_STORAGE, key); else localStorage.removeItem(KEY_STORAGE);
}

async function request(action, params = {}) {
  const key = getIntervalsApiKey();
  if (!key) throw new Error('Falta la clau API personal d’Intervals.icu.');
  const query = new URLSearchParams({ action, ...params });
  const response = await fetch(`/api/intervals?${query.toString()}`, { headers: { 'x-intervals-api-key': key } });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.error || `Intervals.icu ha retornat ${response.status}.`);
  return data;
}

export async function testIntervalsConnection() {
  const data = await request('athlete');
  return { id: data?.id, name: data?.name || data?.firstname || 'Compte connectat' };
}

export async function getRecentIntervalsActivities(days = 3650) {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return request('activities', { oldest: iso(start), newest: iso(end) });
}

export async function getActivityStreams(activityId) { return request('streams', { id: activityId }); }

export async function syncRecentIntervalsActivities({ pb, owner, days = 3650, typeResolver }) {
  const activities = await getRecentIntervalsActivities(days);
  let imported = 0;
  for (const activity of activities || []) {
    const date = String(activity.start_date_local || '').slice(0, 10);
    if (!date) continue;
    const type = typeResolver(activity);
    const activityId = String(activity.id || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const existing = activityId ? await pb.collection('bt_sessions').getFullList({
      filter: `owner = "${owner}" && wearable.activityId = "${activityId}"`,
      sort: '-created',
    }) : [];
    const wearable = {
      source: 'intervals.icu', activityId: activity.id, activityType: activity.type,
      name: activity.name || null, startDateLocal: activity.start_date_local,
      durationSeconds: Number(activity.moving_time || activity.elapsed_time || 0),
      distanceMeters: Number(activity.distance || 0),
      heartRate: { average: Number(activity.average_heartrate || 0) || null, max: Number(activity.max_heartrate || 0) || null, min: Number(activity.min_heartrate || 0) || null },
      calories: Number(activity.calories || 0) || null, trainingLoad: Number(activity.icu_training_load || 0) || null,
      streamTypes: activity.stream_types || [], syncedAt: new Date().toISOString(),
    };
    if (existing[0]) {
      // Important: do not overwrite a manual classification (forestal, aquatic, etc.).
      await pb.collection('bt_sessions').update(existing[0].id, { wearable, date });
    } else {
      await pb.collection('bt_sessions').create({
        type: type || 'manteniment',
        date,
        duration: Math.round((wearable.durationSeconds / 60) * 10) / 10,
        points: 0,
        notes: 'Activitat sincronitzada des d’Intervals.icu · pendent d’associar',
        data: [],
        wearable,
        owner,
      });
    }
    imported += 1;
  }
  return { imported, total: Array.isArray(activities) ? activities.length : 0 };
}
