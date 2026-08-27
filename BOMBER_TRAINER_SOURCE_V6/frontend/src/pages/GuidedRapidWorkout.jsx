import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';

const WARMUP = [
  { name: 'Sidelying Respiratory Glute Max', sets: 2, target: '12 respiracions', rest: 30, instructions: 'Controla la respiració i busca una bona activació del gluti sense compensacions.' },
  { name: 'Hanging stacked supported leg', sets: 2, target: '20 s', rest: 30, instructions: 'Mantén la posició amb control i sense perdre l’alineació.' },
  { name: 'Cat camel', sets: 2, target: '10', rest: 30, instructions: 'Mou la columna de manera lenta i fluida, sense forçar el rang.' },
  { name: 'Sidelying KB arm bar', sets: 2, target: '4 / costat', rest: 30, instructions: 'Braç estable, espatlla controlada i moviment lent.' },
  { name: 'V + cobra', sets: 2, target: '6', rest: 30, instructions: 'Alterna el patró V i l’obertura cobra amb control.' },
];

const MAIN = [
  { name: 'Sentadilla trasera', sets: 4, target: '6', rest: 60, group: 'Superserie de 4 rondes', instructions: 'Posa màxima intenció i executa amb la màxima velocitat possible mantenint la tècnica.' },
  { name: 'Saltos laterales', sets: 4, target: '4 / costat', rest: 60, group: 'Superserie de 4 rondes', instructions: 'Salts ràpids i explosius. Prioritza qualitat, reactivitat i aterratge estable.' },
  { name: 'Squat TRX expansión cadera', sets: 3, target: '6', rest: 30, group: 'Superserie de 4 rondes', instructions: 'Respira tranquil i aprofita la recuperació per relaxar-te.' },
  { name: 'Hollow rock', sets: 3, target: '20 s', rest: 30, group: 'Superserie de 4 rondes', instructions: 'Mantén la tensió abdominal i evita perdre la posició.' },
  { name: 'Cross dead bug', sets: 3, target: '10 / costat', rest: 30, group: 'Superserie de 4 rondes', instructions: 'Controla el tronc mentre alternes braços i cames.' },
  { name: 'Dominada con agarre neutro asistida con goma', sets: 4, target: '5', rest: 60, instructions: 'Busca tensió durant tot el recorregut i controla especialment la baixada.' },
  { name: 'Lanzamiento pelota desde arriba', sets: 4, target: '4', rest: 60, instructions: 'Medball de 4 kg. Llança a la màxima velocitat mantenint una execució segura.' },
  { name: 'Split Stance Cable Chop', sets: 3, target: '12 / costat', rest: 30, video: 'https://youtu.be/OXL5b3qwg0A', instructions: 'Peu més llunyà davant amb lleugera flexió de maluc. Braços estesos, tracciona la politja cap al maluc i controla tota l’excèntrica.' },
];

const ALL = [...WARMUP, ...MAIN];
const DEFAULT_MODE = Object.fromEntries(ALL.map((_, i) => [i, 'official']));

function ExerciseCard({ exercise, index, mode, onMode, values, onValue }) {
  const [open, setOpen] = useState(false);
  const isTraining = mode === 'training';
  return <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-slate-500">{index + 1}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 className="font-extrabold text-slate-900">{exercise.name}</h3><p className="mt-1 text-sm text-slate-500">Objectiu: <strong>{exercise.sets} × {exercise.target}</strong> · Descans: <strong>{exercise.rest}s</strong></p></div>
          <select value={mode} onChange={(e) => onMode(e.target.value)} aria-label={`Mode ${exercise.name}`} className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-3 text-xs font-extrabold">
            <option value="official">Prova oficial</option>
            <option value="training">Entreno</option>
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sèries</p><p className="mt-1 font-extrabold">{exercise.sets}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Objectiu</p><p className="mt-1 font-extrabold">{exercise.target}</p></div>
          <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Descans</p><p className="mt-1 font-extrabold">{exercise.rest}s</p></div>
          <label className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{isTraining ? 'Cops fets' : 'Temps'}</p><input value={isTraining ? values.reps : values.time} onChange={(e) => onValue(isTraining ? 'reps' : 'time', e.target.value)} inputMode="decimal" placeholder={isTraining ? '—' : 'mm:ss'} className="mt-1 w-full bg-transparent font-extrabold outline-none" /></label>
        </div>
        {isTraining && <p className="mt-2 text-xs font-semibold text-slate-400">Entreno: registra l’estímul realitzat; no entra al barem oficial de temps.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(!open)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">{open ? 'Ocultar detalls' : 'Instruccions + vídeo'}</button>
          {exercise.video && <a href={exercise.video} target="_blank" rel="noreferrer" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700">▶ Vídeo</a>}
        </div>
        {open && <div className="mt-3 rounded-2xl bg-blue-50 p-4 text-sm text-slate-700"><p className="font-bold">Com fer-ho</p><p className="mt-1">{exercise.instructions}</p><p className="mt-3 text-xs font-semibold text-slate-500">Historial: aquesta dada queda guardada a la sessió per poder comparar-la amb futures execucions.</p></div>}
      </div>
    </div>
  </article>;
}

export default function GuidedRapidWorkout() {
  const [searchParams] = useSearchParams();
  const sessionDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const [modes, setModes] = useState(DEFAULT_MODE);
  const [values, setValues] = useState(() => Object.fromEntries(ALL.map((_, i) => [i, { reps: '', time: '' }])));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const owner = pb.authStore.record?.id;
        if (!owner) return;
        const rows = await pb.collection('bt_sessions').getList(1, 5, { filter: `owner = "${owner}" && type = "rapid"`, sort: '-date,-created' });
        setHistory(rows.items || []);
      } catch { /* history is optional */ }
    };
    load();
  }, []);

  const setMode = (i, mode) => setModes((prev) => ({ ...prev, [i]: mode }));
  const setValue = (i, key, value) => setValues((prev) => ({ ...prev, [i]: { ...prev[i], [key]: value } }));
  const officialCount = useMemo(() => Object.values(modes).filter((m) => m === 'official').length, [modes]);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const data = ALL.map((exercise, i) => ({ exercici: exercise.name, mode: modes[i], series: exercise.sets, objectiu: exercise.target, descans: exercise.rest, reps: values[i].reps, temps: values[i].time })).filter((x) => x.reps || x.temps);
      if (!data.length) { setError('Registra almenys un exercici abans de guardar.'); setBusy(false); return; }
      await pb.collection('bt_sessions').create({ type: 'rapid', date: sessionDate, duration: 0, points: 20, incidents: '', notes, data, owner: pb.authStore.record.id });
      navigate('/progres');
    } catch (err) { setError(err?.message || 'No s’ha pogut guardar la sessió.'); } finally { setBusy(false); }
  };

  return <AppShell title="Entrenament ràpid">
    <Helmet><title>Entrenament ràpid — BOMBER TRAINER</title></Helmet>
    <div className="rounded-3xl bg-amber-50 p-5" style={{ borderLeft: '8px solid #d97706' }}>
      <p className="text-xs font-black tracking-widest text-amber-700">SESSIÓ GUIADA</p>
      <h1 className="mt-1 text-xl font-black text-slate-900">Entrenament tipus entrenador</h1>
      <p className="mt-1 text-sm font-medium text-slate-700">Mateixa lògica que ja tens: cada exercici pot ser <strong>Prova oficial</strong> o <strong>Entreno</strong>. Oficial registra resultat; entreno registra l’estímul sense obligar a posar temps.</p>
    </div>

    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black tracking-widest text-slate-400">ESCALFAMENT</p><p className="mt-1 text-sm font-semibold text-slate-600">{WARMUP.length} exercicis · {officialCount} en mode oficial</p></div><button type="button" onClick={() => setShowHistory(!showHistory)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-extrabold">{showHistory ? 'Tancar historial' : 'Veure historial'}</button></div>
      {showHistory && <div className="mt-3 space-y-2">{history.length ? history.map((h) => <div key={h.id} className="rounded-2xl bg-slate-50 p-3 text-sm"><strong>{h.date}</strong> · {Array.isArray(h.data) ? h.data.length : 0} registres</div>) : <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-500">Encara no hi ha sessions guardades d’aquest entrenament.</p>}</div>}
    </section>

    <section className="mt-3 space-y-3">{WARMUP.map((exercise, i) => <ExerciseCard key={exercise.name} exercise={exercise} index={i} mode={modes[i]} onMode={(m) => setMode(i, m)} values={values[i]} onValue={(k, v) => setValue(i, k, v)} />)}</section>

    <section className="mt-6 rounded-3xl bg-indigo-50 p-4"><p className="text-xs font-black tracking-widest text-indigo-700">PART PRINCIPAL</p><h2 className="mt-1 text-lg font-black text-slate-900">Superserie de 4 rondes</h2><p className="mt-1 text-sm text-slate-600">La superserie queda agrupada visualment; cada exercici continua tenint el seu mode, objectiu, descans i registre.</p></section>
    <section className="mt-3 space-y-3">{MAIN.map((exercise, j) => { const i = WARMUP.length + j; return <ExerciseCard key={exercise.name} exercise={exercise} index={i} mode={modes[i]} onMode={(m) => setMode(i, m)} values={values[i]} onValue={(k, v) => setValue(i, k, v)} />; })}</section>

    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <label className="grid gap-1 text-sm font-bold">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Sensacions, càrrega, incidències…" className="mt-1 rounded-2xl border border-slate-300 p-3" /></label>
      {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
      <button type="button" disabled={busy} onClick={save} className="mt-4 min-h-[54px] w-full rounded-2xl bg-slate-900 font-black text-white disabled:opacity-50">{busy ? 'Guardant…' : 'Guardar entrenament'}</button>
    </section>
  </AppShell>;
}
