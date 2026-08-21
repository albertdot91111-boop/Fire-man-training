import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { TYPES, formatTime, gradeForTime, levelFor, maintenanceEvolution, streak, today, totalPoints } from '@/lib/btData';

function monthGrid(sessions) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const byDate = {};
    sessions.forEach((s) => { const key = String(s.date || '').slice(0, 10); if (key) (byDate[key] ||= []).push(s); });
    const cells = [];
    for (let i = 0; i < (start.getDay() + 6) % 7; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) {
        const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, key, sessions: byDate[key] || [] });
    }
    return cells;
}

function legacyMinuteAware(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':');
        const minutes = Number(m), seconds = Number(s);
        return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n < 20 ? n * 60 : n;
}

function storedSeconds(value) {
    if (typeof value === 'number') return value > 0 ? value : 0;
    return legacyMinuteAware(value);
}

function sessionEntry(session, name) {
    const wanted = String(name).trim().toLowerCase();
    return (Array.isArray(session?.data) ? session.data : []).find((entry) => String(entry?.exercici || '').trim().toLowerCase() === wanted);
}

function forestalSeries(sessions, entryName, label) {
    return sessions.filter((s) => s.type === 'forestal').map((s) => {
        const entry = sessionEntry(s, entryName);
        if (!entry) return null;
        const seconds = storedSeconds(entry.temps);
        if (!seconds) return null;
        return { date: String(s.date || '').slice(5, 10), fullDate: String(s.date || '').slice(0, 10), seconds, label };
    }).filter(Boolean).sort((a, b) => a.fullDate.localeCompare(b.fullDate)).slice(-12).map((item, index) => ({ ...item, pointLabel: `${item.date} · #${index + 1}` }));
}

function forestalCompleteSeries(sessions) {
    return sessions.filter((s) => s.type === 'forestal').map((s) => {
        const entry = sessionEntry(s, 'CIRCUIT COMPLET');
        if (!entry) return null;
        const seconds = storedSeconds(entry.temps);
        if (!seconds) return null;
        return { date: String(s.date || '').slice(5, 10), fullDate: String(s.date || '').slice(0, 10), seconds, label: 'Ruta completa' };
    }).filter(Boolean).sort((a, b) => a.fullDate.localeCompare(b.fullDate)).slice(-12).map((item, index) => ({ ...item, pointLabel: `${item.date} · #${index + 1}` }));
}

function timeSeries(sessions, type) {
    return sessions.filter((s) => s.type === type).map((s) => ({ date: String(s.date || '').slice(5, 10), fullDate: String(s.date || '').slice(0, 10), seconds: storedSeconds(s.duration) * 60 })).filter((x) => x.seconds > 0).sort((a, b) => a.fullDate.localeCompare(b.fullDate)).slice(-12).map((item, index) => ({ ...item, pointLabel: `${item.date} · #${index + 1}` }));
}

export default function ProgressPage() {
    const [sessions, setSessions] = useState([]);
    const [weights, setWeights] = useState([]);
    const [goals, setGoals] = useState([]);
    const [loadError, setLoadError] = useState('');
    const [w, setW] = useState('');
    const [fat, setFat] = useState('');
    const [goalTitle, setGoalTitle] = useState('');
    const [goalTarget, setGoalTarget] = useState('');
    const [goalCurrent, setGoalCurrent] = useState('');
    const [dayKey, setDayKey] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const load = async () => {
        if (!pb.authStore.isValid || !pb.authStore.record?.id) {
            setLoadError('La sessió d\'usuari encara no està carregada. Torna a obrir Progrés després d\'iniciar sessió.');
            return;
        }
        setLoadError('');
        try {
            const [nextSessions, nextWeights, nextGoals] = await Promise.all([
                pb.collection('bt_sessions').getFullList({ sort: '-date' }),
                pb.collection('bt_weights').getFullList({ sort: '-date' }),
                pb.collection('bt_goals').getFullList({ sort: '-created' }),
            ]);
            setSessions(nextSessions);
            setWeights(nextWeights);
            setGoals(nextGoals);
        } catch (err) {
            setSessions([]);
            const status = err?.status ? ` (${err.status})` : '';
            const message = err?.response?.message || err?.message || 'error desconegut';
            setLoadError(`No puc llegir les dades de Progrés${status}: ${message}`);
        }
    };

    useEffect(() => {
        load();
        const unsubscribe = pb.authStore.onChange(() => { load(); });
        return () => { unsubscribe?.(); };
    }, []);

    const points = totalPoints(sessions);
    const cells = useMemo(() => monthGrid(sessions), [sessions]);
    const daySessions = useMemo(() => dayKey ? sessions.filter((s) => String(s.date || '').slice(0, 10) === dayKey) : [], [sessions, dayKey]);
    const bestBench = useMemo(() => sessions.reduce((best, s) => Math.max(best, ...(Array.isArray(s.data) ? s.data : []).filter((e) => String(e.exercici || '').toLowerCase().includes('press banca')).map((e) => Number(e.pes) || 0)), 0), [sessions]);
    const structuralTimes = useMemo(() => timeSeries(sessions, 'estructural'), [sessions]);
    const forestalTram1 = useMemo(() => forestalSeries(sessions, 'TRAM 1', 'Tram 1'), [sessions]);
    const forestalTram2 = useMemo(() => forestalSeries(sessions, 'TRAM 2', 'Tram 2'), [sessions]);
    const forestalTram3 = useMemo(() => forestalSeries(sessions, 'TRAM 3', 'Tram 3'), [sessions]);
    const forestalComplete = useMemo(() => forestalCompleteSeries(sessions), [sessions]);
    const aquaticTimes = useMemo(() => timeSeries(sessions, 'aquatic'), [sessions]);
    const maintenanceSeries = useMemo(() => maintenanceEvolution(sessions), [sessions]);
    const weightSeries = weights.slice(0, 30).reverse().map((x) => ({ date: String(x.date || '').slice(5, 10), pes: x.weight }));

    const deleteSession = async (session) => {
        if (!session?.id || deletingId) return;
        const type = TYPES[session.type]?.label || session.type || 'sessió';
        const confirmed = window.confirm(`Eliminar ${type} del ${String(session.date || '').slice(0, 10)}? Aquesta acció no es pot desfer.`);
        if (!confirmed) return;
        setDeletingId(session.id);
        try {
            await pb.collection('bt_sessions').delete(session.id);
            setSessions((current) => current.filter((s) => s.id !== session.id));
        } catch (err) {
            setLoadError(err?.response?.message || err?.message || 'No s\'ha pogut eliminar la sessió.');
        } finally {
            setDeletingId(null);
        }
    };

    const addWeight = async (e) => {
        e.preventDefault();
        try {
            await pb.collection('bt_weights').create({ date: today(), weight: Number(w) || 0, fat: Number(fat) || 0, owner: pb.authStore.record.id });
            setW(''); setFat(''); load();
        } catch (err) { setLoadError(err?.response?.message || err?.message || 'No s\'ha pogut guardar el pes.'); }
    };

    const addGoal = async (e) => {
        e.preventDefault();
        try {
            await pb.collection('bt_goals').create({ title: goalTitle, target: Number(goalTarget) || 0, current: Number(goalCurrent) || 0, unit: '', owner: pb.authStore.record.id });
            setGoalTitle(''); setGoalTarget(''); setGoalCurrent(''); load();
        } catch (err) { setLoadError(err?.response?.message || err?.message || 'No s\'ha pogut guardar l\'objectiu.'); }
    };

    const renderTimeProgress = (title, type, series, emptyText) => {
        const latest = series[series.length - 1];
        const best = series.length ? Math.min(...series.map((x) => x.seconds)) : 0;
        const latestGrade = latest ? gradeForTime(type, latest.seconds) : null;
        const bestGrade = best ? gradeForTime(type, best) : null;
        return <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">{title}</h2><p className="mt-1 text-sm text-slate-500">Evolució del temps total. Com menys, millor.</p></div>{latest && <div className="text-right"><p className="text-xs font-bold text-slate-400">ÚLTIM</p><p className="text-xl font-extrabold">{formatTime(latest.seconds)}</p><p className="text-xs font-bold text-slate-600">{latestGrade ? `Nota aprox. ${latestGrade}` : 'Nota pendent de barem'}</p></div>}</div>{series.length ? <><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">MILLOR TEMPS</p><p className="text-lg font-extrabold">{formatTime(best)}</p><p className="text-xs text-slate-500">{bestGrade ? `Nota aprox. ${bestGrade}` : 'Sense barem numèric'}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">ÚLTIM</p><p className="text-lg font-extrabold">{formatTime(latest.seconds)}</p><p className="text-xs text-slate-500">{latest.fullDate}</p></div></div><div className="mt-4 h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="pointLabel" fontSize={11} /><YAxis domain={[0, 180]} ticks={[0, 60, 120, 180]} tickFormatter={formatTime} fontSize={12} /><Tooltip labelFormatter={(label) => `Sessió ${label}`} formatter={(value) => [formatTime(value), 'Temps']} /><Line type="monotone" dataKey="seconds" name="Temps" stroke={TYPES[type].color} strokeWidth={3} dot /></LineChart></ResponsiveContainer></div></> : <p className="mt-4 text-sm text-slate-400">{emptyText}</p>}</section>;
    };

    const renderForestalChart = (title, series, emptyText, color) => {
        const latest = series[series.length - 1];
        const best = series.length ? Math.min(...series.map((x) => x.seconds)) : 0;
        const showGrade = title === 'Ruta completa';
        const latestGrade = showGrade && latest ? gradeForTime('forestal', latest.seconds) : null;
        const bestGrade = showGrade && best ? gradeForTime('forestal', best) : null;
        return <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-extrabold">{title}</h3><p className="mt-1 text-xs text-slate-500">Temps de cada execució. Escala 0–3 min.</p></div>{latest && <div className="text-right"><p className="text-[10px] font-bold text-slate-400">ÚLTIM</p><p className="text-lg font-extrabold">{formatTime(latest.seconds)}</p>{showGrade && <p className="text-xs font-bold text-slate-600">Nota {latestGrade ?? '—'}</p>}</div>}</div>{series.length ? <><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">MILLOR</p><p className="text-base font-extrabold">{formatTime(best)}</p>{showGrade && <p className="text-xs text-slate-500">Nota {bestGrade ?? '—'}</p>}</div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-400">REGISTRES</p><p className="text-base font-extrabold">{series.length}</p><p className="text-xs text-slate-500">{latest.fullDate}</p></div></div><div className="mt-3 h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="pointLabel" fontSize={10} /><YAxis domain={[0, 180]} ticks={[0, 60, 120, 180]} tickFormatter={formatTime} fontSize={11} /><Tooltip labelFormatter={(label) => label} formatter={(value) => [formatTime(value), 'Temps']} /><Line type="monotone" dataKey="seconds" name="Temps" stroke={color} strokeWidth={3} dot /></LineChart></ResponsiveContainer></div></> : <p className="mt-3 text-sm text-slate-400">{emptyText}</p>}</section>;
    };

    return <AppShell title="El meu progrés"><Helmet><title>El meu progrés — BOMBER TRAINER</title><meta name="description" content="Millors marques, evolució de temps, gràfiques de pes corporal i objectius de l'opositor." /></Helmet>{loadError && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{loadError}</div>}<section className="grid grid-cols-3 gap-3">{[['Punts', points], ['Ratxa', `${streak(sessions)} d`], ['Nivell', levelFor(points).name]].map(([k, v]) => <div key={k} className="rounded-3xl bg-white border border-slate-200 p-4 text-center shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">{k.toUpperCase()}</p><p className="mt-1 text-lg font-extrabold">{v}</p></div>)}</section><section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Calendari del mes</h2><p className="mt-1 text-xs text-slate-500">Toca qualsevol dia per obrir el teu calendari personal, encara que no hi hagi cap sessió.</p><div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">{['dl','dt','dc','dj','dv','ds','dg'].map((d) => <span key={d}>{d}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1">{cells.map((c, i) => c ? <button key={c.key} type="button" onClick={() => setDayKey(c.key)} aria-label={`Obrir calendari personal del dia ${c.day}`} className="flex h-14 cursor-pointer flex-col items-center justify-start gap-1 rounded-lg border border-transparent p-1 text-sm font-bold transition hover:border-slate-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400" style={{ backgroundColor: c.sessions.length ? TYPES[c.sessions[0].type]?.soft || '#e2e8f0' : '#f8fafc', color: c.sessions.length ? TYPES[c.sessions[0].type]?.color || '#475569' : '#94a3b8' }}><span>{c.day}</span>{c.sessions.length > 0 && <span className="flex items-center gap-1">{c.sessions.slice(0, 4).map((s, idx) => <span key={s.id || idx} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TYPES[s.type]?.color || '#64748b' }} />)}{c.sessions.length > 4 && <span className="text-[9px]">+{c.sessions.length - 4}</span>}</span>}</button> : <div key={`e${i}`} className="h-14 rounded-lg bg-slate-50" />)}</div></section>{dayKey && <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold">Sessions del {dayKey}</h2><p className="mt-1 text-sm text-slate-500">Si t'has equivocat, elimina només aquella sessió.</p></div><button type="button" onClick={() => setDayKey(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">Tancar</button></div><div className="mt-4 space-y-2">{daySessions.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aquest dia encara no té cap sessió. El calendari personal ja està obert: aquí afegirem les marques d'entrenament i nutrició del dia.</p>}{daySessions.map((s) => { const type = TYPES[s.type] || { label: s.type, color: '#475569', soft: '#f1f5f9' }; return <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{ backgroundColor: type.soft }}><div><p className="font-extrabold" style={{ color: type.color }}>{type.label}</p><p className="text-xs text-slate-500">{String(s.date || '').slice(0, 10)}{s.duration ? ` · ${formatTime(Number(s.duration) * 60)}` : ''}</p></div><button type="button" disabled={deletingId === s.id} onClick={() => deleteSession(s)} aria-label={`Eliminar ${type.label}`} title="Eliminar sessió" className="flex min-h-10 min-w-10 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm disabled:opacity-50"><span className="text-lg font-black">−</span></button></div>; })}</div></section>}<section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Millors marques</h2><p className="mt-2 text-sm text-slate-600">Press banca: <strong>{bestBench || '—'} kg</strong></p><p className="text-sm text-slate-600">Sessions registrades: <strong>{sessions.length}</strong></p></section><section className="rounded-3xl bg-orange-50 border border-orange-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Incendi forestal</h2><p className="mt-1 text-sm text-slate-600">Cada tram per separat i ruta completa només quan realment l'has registrat.</p><div className="mt-4 grid gap-4">{renderForestalChart('Tram 1', forestalTram1, 'Encara no hi ha cap temps del Tram 1.', '#ea580c')}{renderForestalChart('Tram 2', forestalTram2, 'Encara no hi ha cap temps del Tram 2.', '#ea580c')}{renderForestalChart('Tram 3', forestalTram3, 'Encara no hi ha cap temps del Tram 3.', '#ea580c')}{renderForestalChart('Ruta completa', forestalComplete, 'No apareix fins que registris un CIRCUIT COMPLET.', '#c2410c')}</div></section>{renderTimeProgress('Incendi urbà / estructural', 'estructural', structuralTimes, 'Registra un incendi urbà per veure la progressió.')}{renderTimeProgress('Prova aquàtica', 'aquatic', aquaticTimes, 'Registra una prova aquàtica per veure la progressió.')}<section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Evolució de manteniment</h2><p className="mt-1 text-sm text-slate-500">Sèries registrades i volum total per sessió.</p><div className="mt-4 h-48">{maintenanceSeries.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={maintenanceSeries}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Line type="monotone" dataKey="total" name="Total" stroke="#ca8a04" strokeWidth={3} dot /></LineChart></ResponsiveContainer> : <p className="text-sm text-slate-400">Registra sèries com 15/15/12 per veure'n l'evolució.</p>}</div></section><section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Pes corporal</h2><form onSubmit={addWeight} className="mt-3 flex flex-wrap gap-2"><input required type="number" step="0.1" placeholder="Pes (kg)" value={w} onChange={(e) => setW(e.target.value)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-3" /><input type="number" step="0.1" placeholder="% greix" value={fat} onChange={(e) => setFat(e.target.value)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-3" /><button type="submit" className="min-h-[48px] rounded-xl bg-slate-900 px-5 font-bold text-white">Guardar</button></form>{weightSeries.length ? <div className="mt-4 h-48"><LineChart width={600} height={190} data={weightSeries}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" fontSize={12} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} /><Tooltip /><Line type="monotone" dataKey="pes" stroke="#2563eb" strokeWidth={3} dot={false} /></LineChart></div> : <p className="mt-4 text-sm text-slate-400">Registra el teu pes per veure l'evolució dels últims 30 dies.</p>}</section><section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Objectius</h2><form onSubmit={addGoal} className="mt-3 grid gap-2 sm:grid-cols-4"><input required placeholder="Press banca 65kg x20" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 sm:col-span-2" /><input type="number" placeholder="Objectiu" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /><input type="number" placeholder="Actual" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /><button type="submit" className="min-h-[48px] rounded-xl bg-slate-900 font-bold text-white sm:col-span-4">Afegir objectiu</button></form><ul className="mt-4 space-y-3">{goals.length === 0 && <li className="text-sm text-slate-400">Cap objectiu establert.</li>}{goals.map((g) => { const pct = g.target ? Math.min(100, Math.round(((g.current || 0) / g.target) * 100)) : 0; return <li key={g.id}><div className="flex justify-between text-sm font-semibold"><span>{g.title}</span><span>{pct}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-600" style={{ width: `${pct}%` }} /></div></li>; })}</ul></section></AppShell>;
}
