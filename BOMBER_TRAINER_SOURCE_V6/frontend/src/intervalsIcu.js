const KEY_STORAGE = 'bt_intervals_icu_api_key';

export function getIntervalsApiKey() {
  return localStorage.getItem(KEY_STORAGE) || '';
}

export function setIntervalsApiKey(value) {
  const key = String(value || '').trim();
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

function authHeaders() {
  const key = getIntervalsApiKey();
  if (!key) throw new Error('Falta la clau API personal d’Intervals.icu.');
  return { Authorization: `Basic ${btoa(`API_KEY:${key}`)}` };
}

async function request(path) {
  const response = await fetch(`https://intervals.icu${path}`, { headers: authHeaders() });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) throw new Error(data?.error || `Intervals.icu ha retornat ${response.status}.`);
  return data;
}

export async function testIntervalsConnection() {
  const data = await request('/api/v1/athlete/0');
  return { id: data?.id, name: data?.name || data?.firstname || 'Compte connectat' };
}

export async function getRecentIntervalsActivities(days = 30) {
  const end = new Date();
  const start = new Date(Date.now() - days * 86400000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return request(`/api/v1/athlete/0/activities?oldest=${iso(start)}&newest=${iso(end)}`);
}

export async function getActivityStreams(activityId) {
  return request(`/api/v1/activity/${encodeURIComponent(activityId)}/streams.json?types=heartrate,time,distance,velocity_smooth,altitude`);
}

export async function syncRecentIntervalsActivities({ pb, owner, days = 30, typeResolver }) {
  const activities = await getRecentIntervalsActivities(days);
  let imported = 0;
  for (const activity of activities || []) {
    const date = String(activity.start_date_local || '').slice(0, 10);
    if (!date) continue;
    const type = typeResolver(activity);
    if (!type) continue;

    const existing = await pb.collection('bt_sessions').getFullList({
      filter: `owner = \"${owner}\" && date = \"${date}\" && type = \"${type}\"`,
      sort: '-created',
    });

    const wearable = {
      source: 'intervals.icu',
      activityId: activity.id,
      activityType: activity.type,
      name: activity.name || null,
      startDateLocal: activity.start_date_local,
      durationSeconds: Number(activity.moving_time || activity.elapsed_time || 0),
      distanceMeters: Number(activity.distance || 0),
      heartRate: {
        average: Number(activity.average_heartrate || 0) || null,
        max: Number(activity.max_heartrate || 0) || null,
        min: Number(activity.min_heartrate || 0) || null,
      },
      calories: Number(activity.calories || 0) || null,
      trainingLoad: Number(activity.icu_training_load || 0) || null,
      streamTypes: activity.stream_types || [],
      syncedAt: new Date().toISOString(),
    };

    if (existing[0]) {
      await pb.collection('bt_sessions').update(existing[0].id, { wearable });
    } else {
      await pb.collection('bt_sessions').create({
        type,
        date,
        duration: Math.round((wearable.durationSeconds / 60) * 10) / 10,
        points: 0,
        notes: 'Activitat sincronitzada des d’Intervals.icu',
        data: [],
        wearable,
        owner,
      });
    }
    imported += 1;
  }
  return { imported, total: Array.isArray(activities) ? activities.length : 0 };
}
