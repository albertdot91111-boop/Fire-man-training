import React, { useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { today } from '@/lib/btData';
import { getTrainerPlan } from '@/lib/trainerPlans';

const WARMUP = [
  ['Sidelying Respiratory Glute Max', '2 × 12 respiracions', 30, 'Controla la respiració i activa el gluti sense compensacions.'],
  ['Hanging stacked supported leg', '2 × 20 s', 30, 'Mantén la posició amb control i bona alineació.'],
  ['Cat camel', '2 × 10', 30, 'Mou la columna lentament i de manera fluida.'],
  ['Sidelying KB arm bar', '2 × 4 / costat', 30, 'Espatlla estable i moviment lent i controlat.'],
  ['V + cobra', '2 × 6', 30, 'Alterna V i cobra amb control.'],
];
const GROUPS = [{ title: '🎯 EXERCICIS PER A PROVES', subtitle: 'Transferència directa a les proves.', exercises: [['Burpees', 'Repeticions o temps'], ['SLAM ball', 'Repeticions o temps']] }];
const GENERAL_GROUPS = [
  { title: '🏋️ TRONC SUPERIOR', exercises: [['Flexions', 'Repeticions'], ['Fons', 'Repeticions'], ['Dominades supines', 'Repeticions'], ['Dominades pronades', 'Repeticions']] },
  { title: '🦵 TRONC INFERIOR', exercises: [['Pes mort', 'Pes (kg) + repeticions'], ['Lunges', 'Repeticions'], ['Sentadilles', 'Pes (kg) + repeticions']] },
  { title: '🧱 CORE / ABS', exercises: [['Abdominals', 'Repeticions'], ['Planxa', 'Temps (30 s, 60 s...)'], ['Elevacions de cames penjat', 'Repeticions']] },
];
const ALL_GROUPS = [...GROUPS, ...GENERAL_GROUPS];
const EXERCISES = ALL_GROUPS.flatMap((group) => group.exercises.map(([name, detail]) => ({ name, detail, group: group.title })));
const emptySeries = () => ({ weight: '', bodyweight: false, value: '', time: '', mode: 'training' });
const initialValues = () => Object.fromEntries(EXERCISES.map((e) => [e.name, [emptySeries()]]));

function WarmupCard({ exercise, index, value, setValue }) {
  const [name, target, rest, instructions] = exercise;
  return <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">{index + 1}</div><div className="min-w-0 flex-1"><div><h3 className="font-extrabold text-slate-900">{name}</h3><p className="mt-1 text-sm text-slate-500"><strong>{target}</strong> · Descans: <strong>{rest}s</strong></p></div><div className="mt-3 rounded-2xl bg-slate-50 p-3"><label className="text-xs font-bold text-slate-500">Resultat<input value={value.reps} onChange={(e) => setValue('reps', e.target.value)} inputMode="decimal" placeholder="—" className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold" /></label></div><p className="mt-2 text-xs font-semibold text-slate-500">{instructions}</p></div></div></article>;
}

export default function MaintenancePage() {
  const [searchParams] = useSearchParams(); const navigate = useNavigate();
  const selectedDate = searchParams.get('date'); const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate : today();
  const trainerPlan = getTrainerPlan(searchParams.get('trainerPlan'));
  const trainerExercises = trainerPlan ? trainerPlan.sections.flatMap((section) => section.items.map(([name, target]) => ({ name, target, group: section.title }))) : [];
  const trainerInitialValues = () => Object.fromEntries(trainerExercises.map((exercise) => [exercise.name, [emptySeries()]]));
  const [duration, setDuration] = useState(searchParams.get('durada') || (trainerPlan?.duration || '10'));
  const [values, setValues] = useState(() => trainerPlan ? trainerInitialValues() : initialValues());
  const [rpe, setRpe] = useState(''); const [liked, setLiked] = useState(0); const [warmupValues, setWarmupValues] = useState(() => Object.fromEntries(WARMUP.map((_, i) => [i, { reps: '', time: '' }])));
  const [notes, setNotes] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(ALL_GROUPS.map((group, index) => [group.title, index === 0]))); const [generalOpen, setGeneralOpen] = useState(true); const [warmupOpen, setWarmupOpen] = useState(true);
  const updateSeries = (name, index, field, value) => setValues((prev) => ({ ...prev, [name]: prev[name].map((series, i) => i === index ? { ...series, [field]: value } : series) }));
  const addSeries = (name) => setValues((prev) => ({ ...prev, [name]: [...prev[name], emptySeries()] }));
  const removeSeries = (name, index) => setValues((prev) => ({ ...prev, [name]: prev[name].length > 1 ? prev[name].filter((_, i) => i !== index) : prev[name] }));
  const toggleBodyweight = (name, index) => setValues((prev) => ({ ...prev, [name]: prev[name].map((series, i) => i === index ? { ...series, bodyweight: !series.bodyweight, weight: '' } : series) }));
  const toggleGroup = (title) => setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  const setWarmupValue = (i, key, value) => setWarmupValues((prev) => ({ ...prev, [i]: { ...prev[i], [key]: value } }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const warmupData = trainerPlan ? [] : WARMUP.map(([name, target, rest], i) => ({ exercici: name, categoria: 'ESCALFAMENT', mode: 'training', objectiu: target, descans: rest, repeticions: warmupValues[i].reps, temps: warmupValues[i].time })).filter((x) => x.repeticions || x.temps);
      const exerciseSource = trainerPlan ? trainerExercises : EXERCISES;
      const exerciseData = exerciseSource.flatMap((exercise) => values[exercise.name].map((series, index) => ({ exercise, series, index })).filter(({ series }) => series.value || series.time || series.weight || series.bodyweight).map(({ exercise, series, index }) => ({ exercici: exercise.name, categoria: exercise.group, serie: index + 1, mode: 'training', objectiu: exercise.target || '', llastKg: series.bodyweight ? 'pes corporal' : String(series.weight || '').trim(), repeticions: String(series.value || '').trim(), temps: String(series.time || '').trim() })));
      const data = [...warmupData, ...exerciseData];
      if (!data.length) { setError('Registra almenys un exercici abans de guardar.'); return; }
      const sessionNotes = [notes.trim(), trainerPlan && rpe ? `RPE: ${rpe}/10` : '', trainerPlan && liked ? `T'ha agradat: ${liked}/5` : ''].filter(Boolean).join(' · ');
      await pb.collection('bt_sessions').create({ type: 'manteniment', date: sessionDate, duration: Number(duration) || 0, points: 1, incidents: '', notes: sessionNotes, data, owner: pb.authStore.record.id }); navigate('/progres');
    } catch (err) { setError(err?.message || 'No s’ha pogut guardar la sessió.'); } finally { setSaving(false); }
  };

  const renderExercises = (group) => <div className="space-y-3 border-t border-slate-200 p-4">{group.exercises.map(([name, detail]) => <div key={name} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{name}</h3><p className="text-xs text-slate-500">{detail}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">opcional</span></div><div className="mt-3 space-y-2">{values[name].map((series, index) => <div key={`${name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold text-slate-600">Sèrie {index + 1}</span>{values[name].length > 1 && <button type="button" onClick={() => removeSeries(name, index)} className="text-xs font-bold text-slate-400">Eliminar</button>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><label className="grid gap-1 text-xs font-bold text-slate-500">Pes kg<input type="number" min="0" step="0.5" disabled={series.bodyweight} value={series.weight} onChange={(e) => updateSeries(name, index, 'weight', e.target.value)} placeholder={series.bodyweight ? 'Propi pes' : '—'} className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold disabled:bg-slate-100" /></label><label className="grid gap-1 text-xs font-bold text-slate-500">Repeticions<input type="number" min="0" value={series.value} onChange={(e) => updateSeries(name, index, 'value', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label><label className="grid gap-1 text-xs font-bold text-slate-500">Temps<input type="text" inputMode="decimal" value={series.time} onChange={(e) => updateSeries(name, index, 'time', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold" /></label></div><button type="button" onClick={() => toggleBodyweight(name, index)} className={`mt-2 rounded-xl px-3 py-2 text-xs font-extrabold ${series.bodyweight ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{series.bodyweight ? '✓ PES CORPORAL' : 'Usar pes corporal'}</button></div>)}<button type="button" onClick={() => addSeries(name)} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-700">+ Afegir sèrie</button></div></div>)}</div>;
  const renderSection = (group) => { const isOpen = Boolean(openGroups[group.title]); return <section key={group.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm"><button type="button" onClick={() => toggleGroup(group.title)} className="flex w-full items-center justify-between gap-3 p-5 text-left"><div><h2 className="text-lg font-extrabold text-slate-900">{group.title}</h2>{group.subtitle && <p className="text-sm text-slate-500">{group.subtitle}</p>}</div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-bold shadow-sm">{isOpen ? '−' : '+'}</span></button>{isOpen && renderExercises(group)}</section>; };
  const renderTrainerPlan = () => <div className="space-y-4">
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-5 text-white shadow-sm">
      <p className="text-xs font-black tracking-[0.2em] text-orange-300">PAUTA GUARDADA · ENTRENADOR</p>
      <h1 className="mt-2 text-2xl font-black">{trainerPlan.title}</h1>
      <p className="mt-2 text-sm font-medium text-slate-200">{trainerPlan.subtitle}</p>
      <p className="mt-3 text-xs font-semibold text-slate-300">Aquesta sessió queda disponible dins l'app perquè la puguis repetir.</p>
    </section>
    {trainerPlan.sections.map((section) => <section key={section.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5"><p className="text-xs font-black tracking-widest text-orange-600">{section.title}</p></div>
      <div className="space-y-3 bg-slate-50 p-4">
        {section.items.map(([name, target]) => <div key={name} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-slate-900">{name}</h3>{target && <p className="mt-1 text-xs font-bold text-slate-500">{target}</p>}</div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">REGISTRE</span></div>
          {values[name]?.map((series, index) => <div key={index} className="mt-3 rounded-2xl bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-bold text-slate-500">Pes kg<input type="number" min="0" step="0.5" value={series.weight} onChange={(e) => updateSeries(name, index, 'weight', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base font-bold" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-500">Reps / quantitat<input type="text" inputMode="decimal" value={series.value} onChange={(e) => updateSeries(name, index, 'value', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base font-bold" /></label>
              <label className="grid gap-1 text-xs font-bold text-slate-500">Temps<input type="text" value={series.time} onChange={(e) => updateSeries(name, index, 'time', e.target.value)} placeholder="—" className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-base font-bold" /></label>
            </div>
            <button type="button" onClick={() => toggleBodyweight(name, index)} className={`mt-2 rounded-xl px-3 py-2 text-xs font-extrabold ${series.bodyweight ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{series.bodyweight ? '✓ PES CORPORAL' : 'Usar pes corporal'}</button>
          </div>)}
          <button type="button" onClick={() => addSeries(name)} className="mt-2 w-full rounded-2xl border border-dashed border-slate-300 bg-white py-3 text-sm font-extrabold text-slate-700">+ Afegir sèrie</button>
        </div>)}
      </div>
    </section>)}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><p className="text-xs font-black tracking-widest text-slate-400">VALORACIÓ</p><h2 className="mt-1 text-lg font-extrabold">Com ha anat?</h2></div>
      <label className="mt-4 block text-sm font-bold text-slate-700">Valoració d'esforç (RPE) · {rpe || '—'} / 10<input type="range" min="1" max="10" value={rpe || 5} onChange={(e) => setRpe(e.target.value)} className="mt-3 w-full" /></label>
      <div className="mt-5"><p className="text-sm font-bold text-slate-700">T'ha agradat?</p><div className="mt-2 flex gap-2">{[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => setLiked(star)} aria-label={`Valoració ${star} de 5`} className={`text-3xl ${star <= liked ? 'text-yellow-400' : 'text-slate-300'}`}>★</button>)}</div></div>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><label className="grid gap-1 text-sm font-bold text-slate-700">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Com t'ha anat?" className="min-h-[90px] rounded-xl border border-slate-300 p-3" /></label></section>
    {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}
    <button type="button" onClick={save} disabled={saving} className="w-full rounded-2xl bg-slate-900 py-4 text-base font-extrabold text-white disabled:opacity-50">{saving ? 'Guardant…' : 'Guardar sessió'}</button>
  </div>;

  if (trainerPlan) return <AppShell title="Pauta entrenador"><Helmet><title>{trainerPlan.title} — BOMBER TRAINER</title></Helmet>{renderTrainerPlan()}</AppShell>;

  return <AppShell title="Manteniment"><Helmet><title>Manteniment — BOMBER TRAINER</title></Helmet>{selectedDate && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Entrenament del <strong>{sessionDate}</strong>.</div>}<div className="rounded-3xl bg-orange-50 p-5" style={{ borderLeft: '8px solid #f97316' }}><p className="text-xs font-bold tracking-widest text-orange-600">MANTENIMENT</p><h1 className="mt-1 text-xl font-extrabold text-slate-900">Mantén-te preparat sense complicar-ho.</h1><p className="mt-2 text-sm text-slate-600">Escalfament guiat + exercicis.</p></div>
    <section className="mt-4 rounded-3xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => setWarmupOpen((v) => !v)} className="flex w-full items-center justify-between p-5 text-left"><div><p className="text-xs font-black tracking-widest text-orange-600">ESCALFAMENT</p><h2 className="mt-1 text-lg font-extrabold">Preparació abans de la part principal</h2><p className="mt-1 text-sm text-slate-500">{WARMUP.length} exercicis</p></div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-xl font-bold">{warmupOpen ? '−' : '+'}</span></button>{warmupOpen && <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">{WARMUP.map((exercise, i) => <WarmupCard key={exercise[0]} exercise={exercise} index={i} value={warmupValues[i]} setValue={(k, v) => setWarmupValue(i, k, v)} />)}</div>}</section>
    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">TEMPS DISPONIBLE</p><div className="mt-3 grid grid-cols-4 gap-2">{[5, 10, 15, 20].map((min) => <button key={min} type="button" onClick={() => setDuration(String(min))} className={`min-h-[52px] rounded-2xl text-sm font-extrabold ${Number(duration) === min ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>{min} MIN</button>)}</div></section>
    <div className="mt-4 space-y-5">{GROUPS.map(renderSection)}<section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => setGeneralOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 p-5 text-left"><div><h2 className="text-lg font-extrabold text-slate-900">💪 MANTENIMENT GENERAL</h2><p className="text-sm text-slate-500">Força general per mantenir-te preparat.</p></div><span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold">{generalOpen ? '−' : '+'}</span></button>{generalOpen && <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4">{GENERAL_GROUPS.map(renderSection)}</div>}</section></div>
    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4"><label className="grid gap-1 text-sm font-bold text-slate-700">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Com t’ha anat?" className="min-h-[90px] rounded-xl border border-slate-300 p-3" /></label></section>{error && <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}<button type="button" onClick={save} disabled={saving} className="mt-4 w-full rounded-2xl bg-slate-900 py-4 text-base font-extrabold text-white disabled:opacity-50">{saving ? 'Guardant…' : 'Guardar manteniment'}</button>
  </AppShell>;
}
