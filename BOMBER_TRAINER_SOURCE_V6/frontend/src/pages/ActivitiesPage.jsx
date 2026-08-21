import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { TYPES } from '@/lib/btData';

const CLASSIFICATIONS = [
  ['manteniment', 'Entrenament normal'], ['forestal', 'Prova forestal'], ['estructural', 'Prova estructural'],
  ['aquatic', 'Prova aquàtica'], ['pressbanca', 'Press banca'], ['cames', 'Cames'],
];

const labels = {
  running: 'Córrer', run: 'Córrer', trailrun: 'Trail / forestal', trail: 'Trail / forestal',
  swimming: 'Natació', swim: 'Natació', strength: 'Força', weighttraining: 'Força',
  cycling: 'Bici', ride: 'Bici', virtualride: 'Bicicleta estàtica', indoorcycling: 'Bicicleta estàtica', spinning: 'Bicicleta estàtica',
};
const normalizeType = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
const RUNNING_TYPES = new Set(['running', 'run', 'trailrun', 'trail']);
const CYCLING_TYPES = new Set(['cycling', 'ride', 'virtualride', 'indoorcycling', 'spinning']);

function metricNumber(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; }
function formatDuration(seconds) {
  const n = metricNumber(seconds); if (!n) return '—';
  const m = Math.floor(n / 60); const remaining = Math.round((n - m * 60) * 10) / 10;
  const safe = remaining >= 60 ? 0 : remaining;
  return `${m + (remaining >= 60 ? 1 : 0)}:${safe < 10 ? '0' : ''}${safe.toFixed(1)}`;
}
function formatPace(seconds, meters) {
  const s = metricNumber(seconds); const m = metricNumber(meters); if (!s || !m) return '—';
  const whole = Math.round(s / (m / 1000)); if (!Number.isFinite(whole) || whole <= 0 || whole > 3600) return '—';
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')} /km`;
}
function parseWearable(value) {
  if (!value) return {};
  if (typeof value === 'string') { try { return JSON.parse(value) || {}; } catch (_) { return {}; } }
  return value || {};
}
function activityLabel(wearable) {
  const type = normalizeType(wearable?.activityType);
  return labels[type] || wearable?.activityType || wearable?.name || 'Activitat';
}
function isRunningActivity(session) {
  const w = parseWearable(session?.wearable); return RUNNING_TYPES.has(normalizeType(w?.activityType));
}

export default function ActivitiesPage() {
  const [sessions, setSessions] = useState([]); const [loading, setLoading] = useState(true); const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(null); const [filter, setFilter] = useState('all');

  async function load() {
    const owner = pb.authStore.record?.id;
    if (!owner) { setLoadError('No hi ha una sessió d’usuari activa.'); setLoading(false); return; }
    setLoading(true); setLoadError('');
    try {
      const rows = await pb.collection('bt_sessions').getFullList({ sort: '-date,-created', filter: `owner = "${owner}"` });
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setSessions([]); setLoadError(error?.response?.message || error?.message || 'No s’han pogut carregar les activitats.');
    } finally { setLoading(false); }
  }
  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  const visible = useMemo(() => {
    if (filter === 'all') return sessions;
    if (filter === 'pending') return sessions.filter(s => !s.type || s.type === 'manteniment');
    if (filter === 'running') return sessions.filter(isRunningActivity);
    return sessions.filter(s => s.type === filter);
  }, [sessions, filter]);

  async function classify(session, type) {
    setSaving(session.id);
    try {
      await pb.collection('bt_sessions').update(session.id, { type, notes: type === 'manteniment' ? 'Activitat sincronitzada · entrenament normal' : `Activitat sincronitzada · associada a ${TYPES[type]?.label || type}` });
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, type } : s));
    } finally { setSaving(null); }
  }

  return <AppShell title="ACTIVITATS">
    <Helmet><title>Activitats — BOMBER TRAINER</title></Helmet>
    <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-slate-400">SUUNTO · INTERVALS.ICU</p><h2 className="mt-1 text-xl font-extrabold">Activitats sincronitzades</h2><p className="mt-2 text-sm text-slate-500">Aquí decideixes quines sessions són proves reals de preparació i quines són només entrenament.</p></div><Link to="/configuracio" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">⚙️ Configuració</Link></div>
      <div className="mt-4 flex flex-wrap gap-2">{[['all','Totes'],['pending','Pendents / normals'],['running','Curses'],['forestal','Forestals'],['estructural','Estructurals'],['aquatic','Aquàtiques'],['pressbanca','Press banca'],['cames','Cames']].map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${filter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400"><span>{sessions.length} activitats carregades</span><button type="button" onClick={() => load()} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600">↻ Recarregar</button></div>
    </section>
    {loadError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">{loadError}</div>}
    {loading ? <div className="rounded-2xl bg-white p-6 text-center text-slate-500">Carregant activitats…</div> : visible.length === 0 ? <div className="rounded-2xl bg-white p-6 text-center text-slate-500">No hi ha activitats sincronitzades amb aquest filtre.</div> :
      <div className="space-y-3">{visible.map(session => {
        const w = parseWearable(session.wearable); const suunto = parseWearable(w.suunto);
        const heart = w.heartRate && (w.heartRate.average || w.heartRate.max || w.heartRate.min) ? parseWearable(w.heartRate) : parseWearable(suunto.heartRate);
        const dist = metricNumber(w.distanceMeters) || (metricNumber(w.distanceKm) ? w.distanceKm * 1000 : null) || (metricNumber(suunto.distanceKm) ? suunto.distanceKm * 1000 : null);
        // Never derive a workout duration from the app's local session.duration.
        // That field may contain a planned/manual value (e.g. 4 or 5 minutes),
        // not the real elapsed time recorded by Intervals.icu/Suunto.
        const duration = metricNumber(w.durationSeconds) || metricNumber(suunto.durationSeconds);
        const calories = metricNumber(w.calories) || metricNumber(suunto.calories);
        const activityType = normalizeType(w.activityType); const isRunning = RUNNING_TYPES.has(activityType); const isCycling = CYCLING_TYPES.has(activityType);
        const metrics = isRunning
          ? [['Temps', formatDuration(duration)], ['Distància', dist ? `${(dist / 1000).toFixed(2)} km` : '—'], ['Ritme', formatPace(duration, dist)], ['FC mitjana', metricNumber(heart.average) ? `${Math.round(heart.average)} bpm` : '—'], ['FC màxima', metricNumber(heart.max) ? `${Math.round(heart.max)} bpm` : '—']]
          : isCycling
            ? [['Temps', formatDuration(duration)], ['Calories', calories ? `${Math.round(calories)} kcal` : '—'], ...(dist ? [['Distància', `${(dist / 1000).toFixed(2)} km`]] : []), ['FC mitjana', metricNumber(heart.average) ? `${Math.round(heart.average)} bpm` : '—'], ['FC màxima', metricNumber(heart.max) ? `${Math.round(heart.max)} bpm` : '—']]
            : [['Temps', formatDuration(duration)], ...(dist ? [['Distància', `${(dist / 1000).toFixed(2)} km`]] : []), ...(calories ? [['Calories', `${Math.round(calories)} kcal`]] : []), ['FC mitjana', metricNumber(heart.average) ? `${Math.round(heart.average)} bpm` : '—'], ['FC màxima', metricNumber(heart.max) ? `${Math.round(heart.max)} bpm` : '—']];
        return <article key={session.id} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">{session.date || w.startDateLocal?.slice?.(0,10) || 'Sense data'}</p><h3 className="mt-1 font-extrabold">{activityLabel(w)}</h3>{w.name && <p className="text-xs text-slate-500">{w.name}</p>}</div><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: TYPES[session.type]?.soft || '#f1f5f9', color: TYPES[session.type]?.color || '#475569' }}>{session.type === 'manteniment' ? 'Entrenament normal / pendent' : TYPES[session.type]?.label || 'Pendent'}</span></div>
          <div className={`mt-3 grid grid-cols-2 gap-2 ${metrics.length >= 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>{metrics.map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">{label}</span><strong className="block">{value}</strong></div>)}</div>
          {metricNumber(w.trainingLoad) && <p className="mt-2 text-xs text-slate-500">Càrrega Intervals.icu: <b>{Math.round(w.trainingLoad)}</b></p>}
          <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Associar aquesta sessió a</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CLASSIFICATIONS.map(([type,label]) => <button key={type} disabled={saving === session.id} onClick={() => classify(session,type)} className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold ${session.type === type ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}</div></div>
        </article>;
      })}</div>}
  </AppShell>;
}
