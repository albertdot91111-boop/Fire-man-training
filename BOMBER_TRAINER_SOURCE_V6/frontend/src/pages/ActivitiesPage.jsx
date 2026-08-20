import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { TYPES } from '@/lib/btData';

const CLASSIFICATIONS = [
  ['manteniment', 'Entrenament normal'],
  ['forestal', 'Prova forestal'],
  ['estructural', 'Prova estructural'],
  ['aquatic', 'Prova aquàtica'],
  ['pressbanca', 'Press banca'],
  ['cames', 'Cames'],
];

const labels = {
  running: 'Córrer', run: 'Córrer', trailrun: 'Trail / forestal', swimming: 'Natació', swim: 'Natació',
  strength: 'Força', weighttraining: 'Força', cycling: 'Bici',
};

const RUNNING_TYPES = new Set(['running', 'run']);

function metricNumber(v) { return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null; }
function formatDuration(seconds) { const n = metricNumber(seconds); if (!n) return '—'; const m = Math.floor(n / 60); const s = Math.round(n % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function formatPace(seconds, meters) {
  const s = metricNumber(seconds); const m = metricNumber(meters);
  if (!s || !m) return '—';
  const secPerKm = s / (m / 1000);
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return '—';
  const whole = Math.round(secPerKm); return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} /km`;
}
function parseWearable(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch (_) { return {}; }
  }
  return value;
}
function activityLabel(wearable) { return labels[String(wearable?.activityType || '').toLowerCase()] || wearable?.activityType || wearable?.name || 'Activitat'; }
function isRunningActivity(session) {
  const wearable = parseWearable(session?.wearable);
  return RUNNING_TYPES.has(String(wearable?.activityType || '').toLowerCase());
}

export default function ActivitiesPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(null);
  const [filter, setFilter] = useState('all');

  async function load() {
    const owner = pb.authStore.record?.id;
    if (!owner) { setLoadError('No hi ha una sessió d’usuari activa.'); setLoading(false); return; }
    setLoading(true);
    setLoadError('');
    try {
      // PocketBase can return JSON fields either as objects or as serialized JSON.
      // Normalize them here so imported Intervals.icu metrics are always visible.
      const rows = await pb.collection('bt_sessions').getFullList({ sort: '-date,-created' });
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setSessions([]);
      setLoadError(error?.response?.message || error?.message || 'No s’han pogut carregar les activitats.');
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
      await pb.collection('bt_sessions').update(session.id, {
        type,
        notes: type === 'manteniment' ? 'Activitat sincronitzada · entrenament normal' : `Activitat sincronitzada · associada a ${TYPES[type]?.label || type}`,
      });
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, type } : s));
    } finally { setSaving(null); }
  }

  return (
    <AppShell title="ACTIVITATS">
      <Helmet><title>Activitats — BOMBER TRAINER</title></Helmet>
      <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold tracking-widest text-slate-400">SUUNTO · INTERVALS.ICU</p><h2 className="mt-1 text-xl font-extrabold">Activitats sincronitzades</h2><p className="mt-2 text-sm text-slate-500">Aquí decideixes quines sessions són proves reals de preparació i quines són només entrenament.</p></div>
          <Link to="/configuracio" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold">⚙️ Configuració</Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[['all','Totes'],['pending','Pendents / normals'],['running','Curses'],['forestal','Forestals'],['estructural','Estructurals'],['aquatic','Aquàtiques'],['pressbanca','Press banca'],['cames','Cames']].map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${filter === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
          <span>{sessions.length} activitats carregades</span>
          <button type="button" onClick={() => load()} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-600">↻ Recarregar</button>
        </div>
      </section>

      {loadError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">{loadError}</div>}
      {loading ? <div className="rounded-2xl bg-white p-6 text-center text-slate-500">Carregant activitats…</div> : visible.length === 0 ? <div className="rounded-2xl bg-white p-6 text-center text-slate-500">No hi ha activitats sincronitzades amb aquest filtre.</div> :
        <div className="space-y-3">{visible.map(session => {
          const w = parseWearable(session.wearable);
          const suunto = parseWearable(w.suunto);
          const hr = parseWearable(w.heartRate) || parseWearable(suunto.heartRate);
          const dist = metricNumber(w.distanceMeters) || (metricNumber(w.distanceKm) ? metricNumber(w.distanceKm) * 1000 : null) || (metricNumber(suunto.distanceKm) ? metricNumber(suunto.distanceKm) * 1000 : null);
          const duration = metricNumber(w.durationSeconds) || metricNumber(suunto.durationSeconds) || (metricNumber(session.duration) ? metricNumber(session.duration) * 60 : null);
          return <article key={session.id} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-slate-400">{session.date || 'Sense data'}</p><h3 className="mt-1 font-extrabold">{activityLabel(w)}</h3>{w.name && <p className="text-xs text-slate-500">{w.name}</p>}</div><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: TYPES[session.type]?.soft || '#f1f5f9', color: TYPES[session.type]?.color || '#475569' }}>{session.type === 'manteniment' ? 'Entrenament normal / pendent' : TYPES[session.type]?.label || 'Pendent'}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Temps</span><strong className="block">{formatDuration(duration)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Distància</span><strong className="block">{dist ? `${(dist / 1000).toFixed(2)} km` : '—'}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">Ritme</span><strong className="block">{formatPace(duration, dist)}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">FC mitjana</span><strong className="block">{metricNumber(hr.average) ? `${Math.round(hr.average)} bpm` : '—'}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-xs text-slate-500">FC màxima</span><strong className="block">{metricNumber(hr.max) ? `${Math.round(hr.max)} bpm` : '—'}</strong></div></div>
            {metricNumber(w.trainingLoad) && <p className="mt-2 text-xs text-slate-500">Càrrega Intervals.icu: <b>{Math.round(w.trainingLoad)}</b></p>}
            <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Associar aquesta sessió a</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CLASSIFICATIONS.map(([type,label]) => <button key={type} disabled={saving === session.id} onClick={() => classify(session,type)} className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold ${session.type === type ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{label}</button>)}</div></div>
          </article>;
        })}</div>}
    </AppShell>
  );
}
