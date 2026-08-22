import React, { useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { today } from '@/lib/btData';

const GROUPS = [
  {
    title: '🎯 EXERCICIS PER A PROVES',
    subtitle: 'Transferència directa a les proves.',
    exercises: [
      ['Step-up', 'Repeticions o temps'],
      ['Slam Ball', 'Pes (kg) + repeticions'],
      ['Farmer Carry', 'Pes (kg) + distància o temps'],
      ['Burpees', 'Repeticions o temps'],
    ],
  },
  {
    title: '💪 MANTENIMENT GENERAL',
    subtitle: 'Força general per mantenir-te preparat.',
    exercises: [
      ['Flexions', 'Repeticions'],
      ['Fons', 'Repeticions'],
      ['Dominades supines', 'Repeticions'],
      ['Dominades pronades', 'Repeticions'],
      ['Pes mort', 'Pes (kg) + repeticions'],
      ['Lunges', 'Repeticions'],
      ['Sentadilles', 'Pes (kg) + repeticions'],
      ['Abdominals', 'Repeticions'],
      ['Planxa', 'Temps (30 s, 60 s...)'],
      ['Elevacions de cames penjat', 'Repeticions'],
    ],
  },
];

const EXERCISES = GROUPS.flatMap((group) => group.exercises.map(([name, detail]) => ({ name, detail, group: group.title })));

export default function MaintenancePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedDate = searchParams.get('date');
  const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate : today();
  const [duration, setDuration] = useState(searchParams.get('durada') || '10');
  const [values, setValues] = useState(() => Object.fromEntries(EXERCISES.map((e) => [e.name, { weight: '', value: '', time: '' }])));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (name, field, value) => setValues((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const data = EXERCISES
        .map((exercise) => ({ ...exercise, ...values[exercise.name] }))
        .filter((exercise) => exercise.value || exercise.time || exercise.weight)
        .map((exercise) => ({
          exercici: exercise.name,
          categoria: exercise.group,
          llastKg: String(exercise.weight || '').trim(),
          repeticions: String(exercise.value || '').trim(),
          temps: String(exercise.time || '').trim(),
        }));
      if (!data.length) { setError('Registra almenys un exercici abans de guardar.'); return; }
      await pb.collection('bt_sessions').create({ type: 'manteniment', date: sessionDate, duration: Number(duration) || 0, points: 1, incidents: '', notes, data, owner: pb.authStore.record.id });
      navigate('/progres');
    } catch (err) {
      setError(err?.message || 'No s’ha pogut guardar la sessió.');
    } finally { setSaving(false); }
  };

  return <AppShell title="Manteniment">
    <Helmet><title>Manteniment — BOMBER TRAINER</title></Helmet>
    {selectedDate && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Entrenament del <strong>{sessionDate}</strong>.</div>}
    <div className="rounded-3xl p-5" style={{ backgroundColor: '#fff7ed', borderLeft: '8px solid #f97316' }}>
      <p className="text-xs font-bold tracking-widest text-orange-600">MANTENIMENT</p>
      <h1 className="mt-1 text-xl font-extrabold text-slate-900">Mantén-te preparat sense complicar-ho.</h1>
      <p className="mt-2 text-sm text-slate-600">Registra només el que facis. Pots combinar exercicis i indicar repeticions, pes o temps.</p>
    </div>
    <section className="mt-4 rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold tracking-widest text-slate-400">TEMPS DISPONIBLE</p>
      <div className="mt-3 grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((min) => <button key={min} type="button" onClick={() => setDuration(String(min))} className={`min-h-[52px] rounded-2xl text-sm font-extrabold ${Number(duration) === min ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>{min} MIN</button>)}</div>
    </section>
    <div className="mt-4 space-y-5">
      {GROUPS.map((group) => <section key={group.title}>
        <div className="mb-3"><h2 className="text-lg font-extrabold text-slate-900">{group.title}</h2><p className="text-sm text-slate-500">{group.subtitle}</p></div>
        <div className="space-y-3">{group.exercises.map(([name, detail]) => <div key={name} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{name}</h3><p className="text-xs text-slate-500">{detail}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">opcional</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold text-slate-500">Pes kg<input type="number" min="0" step="0.5" value={values[name].weight} onChange={(e) => update(name, 'weight', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-500">Repeticions<input type="number" min="0" value={values[name].value} onChange={(e) => update(name, 'value', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-500">Temps<input type="text" inputMode="decimal" value={values[name].time} onChange={(e) => update(name, 'time', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label>
          </div>
        </div>)}</div>
      </section>)}
    </div>
    <section className="mt-5 rounded-3xl bg-white border border-slate-200 p-4"><label className="grid gap-1 text-sm font-bold text-slate-700">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Com t'ha anat?" className="min-h-[90px] rounded-xl border border-slate-300 p-3" /></label></section>
    {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    <button type="button" onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-slate-900 py-4 text-base font-extrabold text-white disabled:opacity-50">{saving ? 'Guardant…' : 'Guardar manteniment'}</button>
  </AppShell>;
}
