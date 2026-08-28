import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const EXERCISES = [
  'Flexions', 'Fons', 'Dominades supines', 'Dominades pronades',
  'Pes mort', 'Lunges', 'Sentadilles', 'Abdominals', 'Planxa',
  'Elevacions de cames penjat', 'Burpees', 'SLAM ball',
];

const GRAPH_SECTIONS = {
  manteniment: ['Evolució de manteniment'],
  estructural: ['Incendi estructural'],
  pressbanca: ['Press banca'],
  forestal: ['Incendi forestal'],
};

function hasValue(item) {
  if (!item) return false;
  const reps = Number(item.repeticions ?? item.reps);
  const weight = String(item.llastKg ?? item.pes ?? '').trim();
  const time = String(item.temps ?? '').trim();
  return (Number.isFinite(reps) && reps > 0) || Number(weight) > 0 || Boolean(time) || weight.toLowerCase() === 'pes corporal';
}

function parseDate(value) {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : null;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function formatDay(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function trainingSeries(sessions) {
  return sessions
    .filter((session) => Array.isArray(session.data) && session.data.some((item) => item?.mode === 'training'))
    .map((session) => {
      const trainingEntries = session.data.filter((item) => item?.mode === 'training');
      const repetitions = trainingEntries.reduce((sum, item) => {
        const reps = Number(item.repeticions ?? item.reps ?? item.trainingReps);
        return sum + (Number.isFinite(reps) && reps > 0 ? reps : 0);
      }, 0);
      if (!repetitions) return null;
      return {
        date: String(session.date || '').slice(5, 10),
        fullDate: String(session.date || '').slice(0, 10),
        repetitions,
        exercises: trainingEntries.length,
        pointLabel: String(session.date || '').slice(5, 10),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    .slice(-12)
    .map((item, index) => ({ ...item, pointLabel: `${item.date} · #${index + 1}` }));
}

function TrainingGraph({ series }) {
  const latest = series[series.length - 1];
  const best = series.length ? Math.max(...series.map((item) => item.repetitions)) : 0;
  return (
    <section className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Entrenament</h2>
          <p className="mt-1 text-sm text-slate-600">Evolució de les repeticions/cops registrats sense temps.</p>
        </div>
        {latest && <div className="text-right"><p className="text-xs font-bold text-sky-600">ÚLTIM</p><p className="text-xl font-extrabold">{latest.repetitions}</p><p className="text-xs font-bold text-slate-500">repeticions/cops</p></div>}
      </div>
      {series.length ? <>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/80 p-3"><p className="text-[10px] font-bold text-sky-600">MILLOR</p><p className="text-lg font-extrabold">{best}</p><p className="text-xs text-slate-500">reps/cops</p></div>
          <div className="rounded-2xl bg-white/80 p-3"><p className="text-[10px] font-bold text-sky-600">REGISTRES</p><p className="text-lg font-extrabold">{series.length}</p></div>
          <div className="rounded-2xl bg-white/80 p-3"><p className="text-[10px] font-bold text-sky-600">ÚLTIMA</p><p className="text-lg font-extrabold">{latest.exercises}</p><p className="text-xs text-slate-500">exercicis</p></div>
        </div>
        <div className="mt-4 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="pointLabel" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip labelFormatter={(label) => `Sessió ${label}`} formatter={(value) => [`${value}`, 'Repeticions/cops']} />
              <Line type="monotone" dataKey="repetitions" name="Repeticions/cops" stroke="#0284c7" strokeWidth={3} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </> : <p className="mt-4 text-sm text-slate-500">Encara no hi ha entrenaments sense temps registrats.</p>}
    </section>
  );
}

export default function WeeklyMaintenanceSummary({ sessions }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [graph, setGraph] = useState('all');
  const [portalHost, setPortalHost] = useState(null);

  const week = useMemo(() => {
    const monday = startOfWeek(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const keys = new Set(Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return dateKey(d);
    }));
    const weekSessions = sessions.filter((session) => session.type === 'manteniment' && keys.has(String(session.date || '').slice(0, 10)));
    const completed = EXERCISES.map((name) => {
      const done = weekSessions.some((session) => (Array.isArray(session.data) ? session.data : []).some((item) => String(item?.exercici || '').trim().toLowerCase() === name.toLowerCase() && hasValue(item)));
      return { name, done };
    });
    return { monday, sunday, completed, doneCount: completed.filter((item) => item.done).length };
  }, [sessions, weekOffset]);

  const training = useMemo(() => trainingSeries(sessions), [sessions]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return undefined;
    const host = document.createElement('div');
    host.setAttribute('data-bt-graph-selector', 'true');
    main.prepend(host);
    setPortalHost(host);
    return () => host.remove();
  }, []);

  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return undefined;
    const wanted = graph === 'all' ? null : new Set(GRAPH_SECTIONS[graph] || []);
    const sections = Array.from(main.querySelectorAll('section'));
    const original = new Map();
    sections.forEach((section) => {
      const heading = String(section.querySelector('h2')?.textContent || '').trim();
      const managed = Object.values(GRAPH_SECTIONS).flat().includes(heading);
      if (!managed) return;
      original.set(section, section.style.display);
      section.style.display = !wanted || wanted.has(heading) ? '' : 'none';
    });
    return () => original.forEach((value, section) => { section.style.display = value; });
  }, [graph]);

  const isCurrentWeek = weekOffset === 0;
  const selector = (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-bold tracking-widest text-slate-400">GRÀFIQUES</p><h2 className="mt-1 text-lg font-extrabold">Què vols veure?</h2></div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{graph === 'all' ? 'Totes' : '1 vista'}</span>
      </div>
      <select value={graph} onChange={(event) => setGraph(event.target.value)} className="mt-3 min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-extrabold text-slate-800">
        <option value="all">Totes les gràfiques</option>
        <option value="manteniment">Manteniment</option>
        <option value="estructural">Estructural</option>
        <option value="pressbanca">Press banca</option>
        <option value="forestal">Forestal</option>
        <option value="entrenament">Entrenament</option>
      </select>
      {graph === 'entrenament' && <div className="mt-4"><TrainingGraph series={training} /></div>}
    </section>
  );

  return <>
    {portalHost && createPortal(selector, portalHost)}
    <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Manteniment de la setmana</h2>
          <p className="mt-1 text-sm text-slate-500">Verd = fet · Vermell = falta fer</p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-right">
          <p className="text-[10px] font-bold tracking-wide text-slate-400">COMPLETAT</p>
          <p className="text-lg font-extrabold">{week.doneCount}/{EXERCISES.length}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setWeekOffset((value) => value - 1)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-extrabold">←</button>
        <div className="text-center">
          <p className="text-sm font-extrabold">{formatDay(week.monday)} — {formatDay(week.sunday)}</p>
          <p className="text-xs text-slate-400">{isCurrentWeek ? 'Aquesta setmana' : weekOffset < 0 ? 'Setmana anterior' : 'Setmana següent'}</p>
        </div>
        <button type="button" onClick={() => setWeekOffset((value) => value + 1)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-extrabold">→</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {week.completed.map(({ name, done }) => (
          <div key={name} className={`rounded-2xl border-2 p-3 ${done ? 'border-green-500 bg-green-50' : 'border-red-400 bg-red-50'}`}>
            <div className="flex items-start gap-2"><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${done ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{done ? '✓' : '×'}</span><div><p className={`text-sm font-extrabold ${done ? 'text-green-800' : 'text-red-800'}`}>{name}</p><p className={`mt-1 text-[10px] font-bold ${done ? 'text-green-700' : 'text-red-700'}`}>{done ? 'FET AQUESTA SETMANA' : 'PENDENT'}</p></div></div>
          </div>
        ))}
      </div>
    </section>
  </>;
}
