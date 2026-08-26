import React, { useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { today } from '@/lib/btData';

const GROUPS = [
  {
    title: '🎯 EXERCICIS PER A PROVES', subtitle: 'Transferència directa a les proves.',
    exercises: [['Burpees', 'Repeticions o temps']],
  },
];

const GENERAL_GROUPS = [
  { title: '🏋️ TRONC SUPERIOR', exercises: [['Flexions', 'Repeticions'], ['Fons', 'Repeticions'], ['Dominades supines', 'Repeticions'], ['Dominades pronades', 'Repeticions']] },
  { title: '🦵 TRONC INFERIOR', exercises: [['Pes mort', 'Pes (kg) + repeticions'], ['Lunges', 'Repeticions'], ['Sentadilles', 'Pes (kg) + repeticions']] },
  { title: '🧱 CORE / ABS', exercises: [['Abdominals', 'Repeticions'], ['Planxa', 'Temps (30 s, 60 s...)'], ['Elevacions de cames penjat', 'Repeticions']] },
];

const ALL_GROUPS = [...GROUPS, ...GENERAL_GROUPS];
const EXERCISES = ALL_GROUPS.flatMap((group) => group.exercises.map(([name, detail]) => ({ name, detail, group: group.title })));
const emptySeries = () => ({ weight: '', bodyweight: false, value: '', time: '' });
const initialValues = () => Object.fromEntries(EXERCISES.map((e) => [e.name, [emptySeries()]]));

export default function MaintenancePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedDate = searchParams.get('date');
  const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate : today();
  const [duration, setDuration] = useState(searchParams.get('durada') || '10');
  const [values, setValues] = useState(initialValues);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(ALL_GROUPS.map((group, index) => [group.title, index === 0])));
  const [generalOpen, setGeneralOpen] = useState(true);

  const updateSeries = (name, index, field, value) => setValues((prev) => ({
    ...prev, [name]: prev[name].map((series, i) => i === index ? { ...series, [field]: value } : series),
  }));
  const addSeries = (name) => setValues((prev) => ({ ...prev, [name]: [...prev[name], emptySeries()] }));
  const removeSeries = (name, index) => setValues((prev) => ({ ...prev, [name]: prev[name].length > 1 ? prev[name].filter((_, i) => i !== index) : prev[name] }));
  const toggleBodyweight = (name, index) => setValues((prev) => ({
    ...prev, [name]: prev[name].map((series, i) => i === index ? { ...series, bodyweight: !series.bodyweight, weight: '' } : series),
  }));
  const toggleGroup = (title) => setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const data = EXERCISES.flatMap((exercise) => values[exercise.name]
        .map((series, index) => ({ exercise, series, index }))
        .filter(({ series }) => series.value || series.time || series.weight || series.bodyweight)
        .map(({ exercise, series, index }) => ({
          exercici: exercise.name,
          categoria: exercise.group,
          serie: index + 1,
          llastKg: series.bodyweight ? 'pes corporal' : String(series.weight || '').trim(),
          repeticions: String(series.value || '').trim(),
          temps: String(series.time || '').trim(),
        })));
      if (!data.length) { setError('Registra almenys un exercici abans de guardar.'); return; }
      await pb.collection('bt_sessions').create({ type: 'manteniment', date: sessionDate, duration: Number(duration) || 0, points: 1, incidents: '', notes, data, owner: pb.authStore.record.id });
      navigate('/progres');
    } catch (err) {
      setError(err?.message || 'No s’ha pogut guardar la sessió.');
    } finally { setSaving(false); }
  };

  const renderExercises = (group) => <div className="space-y-3 border-t border-slate-200 p-4">{group.exercises.map(([name, detail]) => <div key={name} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{name}</h3><p className="text-xs text-slate-500">{detail}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">opcional</span></div>
    <div className="mt-3 space-y-2">
      {values[name].map((series, index) => <div key={`${name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold text-slate-600">Sèrie {index + 1}</span>{values[name].length > 1 && <button type="button" onClick={() => removeSeries(name, index)} className="text-xs font-bold text-slate-400">Eliminar</button>}</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-bold text-slate-500">Pes kg<input type="number" min="0" step="0.5" disabled={series.bodyweight} value={series.weight} onChange={(e) => updateSeries(name, index, 'weight', e.target.value)} placeholder={series.bodyweight ? 'Propi pes' : '—'} className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold disabled:bg-slate-100" /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-500">Repeticions<input type="number" min="0" value={series.value} onChange={(e) => updateSeries(name, index, 'value', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label>
          <label className="grid gap-1 text-xs font-bold text-slate-500">Temps<input type="text" inputMode="decimal" value={series.time} onChange={(e) => updateSeries(name, index, 'time', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label>
        </div>
        <button type="button" onClick={() => toggleBodyweight(name, index)} className={`mt-2 rounded-xl px-3 py-2 text-xs font-extrabold ${series.bodyweight ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{series.bodyweight ? '✓ PES CORPORAL' : 'Usar pes corporal'}</button>
      </div>)}
      <button type="button" onClick={() => addSeries(name)} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-700">+ Afegir sèrie</button>
    </div>
  </div>)}</div>;

  const renderSection = (group) => {
    const isOpen = Boolean(openGroups[group.title]);
    return <section key={group.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
      <button type="button" onClick={() => toggleGroup(group.title)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-5 text-left"><div><h2 className="text-lg font-extrabold text-slate-900">{group.title}</h2>{group.subtitle && <p className="text-sm text-slate-500">{group.subtitle}</p>}</div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-sm">{isOpen ? '−' : '+'}</span></button>
      {isOpen && renderExercises(group)}
    </section>;
  };

  return <AppShell title="Manteniment">
    <Helmet><title>Manteniment — BOMBER TRAINER</title></Helmet>
    {selectedDate && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Entrenament del <strong>{sessionDate}</strong>.</div>}
    <div className="rounded-3xl p-5" style={{ backgroundColor: '#fff7ed', borderLeft: '8px solid #f97316' }}><p className="text-xs font-bold tracking-widest text-orange-600">MANTENIMENT</p><h1 className="mt-1 text-xl font-extrabold text-slate-900">Mantén-te preparat sense complicar-ho.</h1><p className="mt-2 text-sm text-slate-600">Registra cada sèrie per separat. Pots indicar pes, pes corporal, repeticions i temps.</p></div>
    <section className="mt-4 rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">TEMPS DISPONIBLE</p><div className="mt-3 grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((min) => <button key={min} type="button" onClick={() => setDuration(String(min))} className={`min-h-[52px] rounded-2xl text-sm font-extrabold ${Number(duration) === min ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>{min} MIN</button>)}</div></section>
    <div className="mt-4 space-y-5">{GROUPS.map(renderSection)}<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => setGeneralOpen((v) => !v)} aria-expanded={generalOpen} className="flex w-full items-center justify-between gap-3 p-5 text-left"><div><h2 className="text-lg font-extrabold text-slate-900">💪 MANTENIMENT GENERAL</h2><p className="text-sm text-slate-500">Força general per mantenir-te preparat.</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-bold text-slate-700">{generalOpen ? '−' : '+'}</span></button>{generalOpen && <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">{GENERAL_GROUPS.map(renderSection)}</div>}</section></div>
    <section className="mt-5 rounded-3xl bg-white border border-slate-200 p-4"><label className="grid gap-1 text-sm font-bold text-slate-700">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Com t'ha anat?" className="min-h-[90px] rounded-xl border border-slate-300 p-3" /></label></section>
    {error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    <button type="button" onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-slate-900 py-4 text-base font-extrabold text-white disabled:opacity-50">{saving ? 'Guardant…' : 'Guardar manteniment'}</button>
  </AppShell>;
}