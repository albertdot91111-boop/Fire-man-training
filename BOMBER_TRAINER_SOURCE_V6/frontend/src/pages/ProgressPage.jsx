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
    sessions.forEach((s) => {
        const key = String(s.date || '').slice(0, 10);
        if (key) byDate[key] = s.type;
    });
    const cells = [];
    for (let i = 0; i < (start.getDay() + 6) % 7; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) {
        const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, key, type: byDate[key] });
    }
    return cells;
}

function structuralTotal(session) {
    return (Array.isArray(session.data) ? session.data : []).reduce((sum, entry) => sum + (Number(entry.temps) || 0), 0);
}

function forestalTotal(session) {
    const data = Array.isArray(session.data) ? session.data : [];
    const complete = data.find((entry) => String(entry.exercici || '').toLowerCase().includes('circuit complet'));
    if (Number(complete?.temps) > 0) return Number(complete.temps);
    return data.slice(0, 3).reduce((sum, entry) => sum + (Number(entry.temps) || 0), 0);
}

function timeSeries(sessions, type, totalFn) {
    return sessions
        .filter((s) => s.type === type)
        .map((s) => ({
            date: String(s.date || '').slice(5, 10),
            fullDate: String(s.date || '').slice(0, 10),
            seconds: totalFn(s),
        }))
        .filter((x) => x.seconds > 0)
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
        .slice(-12);
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

    const load = async () => {
        const owner = pb.authStore.record?.id;
        if (!owner) return;
        try {
            setLoadError('');
            const ownerFilter = `owner = "${owner}"`;
            const [sessionRows, weightRows, goalRows] = await Promise.all([
                pb.collection('bt_sessions').getFullList({ sort: '-date', filter: ownerFilter }),
                pb.collection('bt_weights').getFullList({ sort: '-date', filter: ownerFilter }),
                pb.collection('bt_goals').getFullList({ sort: '-created', filter: ownerFilter }),
            ]);
            setSessions(sessionRows);
            setWeights(weightRows);
            setGoals(goalRows);
        } catch (err) {
            setLoadError('No puc llegir les sessions. Revisa les regles List/View de PocketBase.');
        }
    };
    useEffect(() => { load(); }, []);

    const points = totalPoints(sessions);
    const cells = useMemo(() => monthGrid(sessions), [sessions]);

    const bestBench = useMemo(() => {
        let best = 0;
        sessions.forEach((s) => (Array.isArray(s.data) ? s.data : []).forEach((e) => {
            if (String(e.exercici || '').toLowerCase().includes('press banca')) best = Math.max(best, Number(e.pes) || 0);
        }));
        return best;
    }, [sessions]);

    const structuralTimes = useMemo(() => timeSeries(sessions, 'estructural', structuralTotal), [sessions]);
    const forestalTimes = useMemo(() => timeSeries(sessions, 'forestal', forestalTotal), [sessions]);
    const maintenanceSeries = useMemo(() => maintenanceEvolution(sessions), [sessions]);
    const weightSeries = weights.slice(0, 30).reverse().map((x) => ({ date: String(x.date || '').slice(5, 10), pes: x.weight }));

    const addWeight = async (e) => {
        e.preventDefault();
        await pb.collection('bt_weights').create({ date: today(), weight: Number(w) || 0, fat: Number(fat) || 0, owner: pb.authStore.record.id });
        setW(''); setFat(''); load();
    };

    const addGoal = async (e) => {
        e.preventDefault();
        await pb.collection('bt_goals').create({ title: goalTitle, target: Number(goalTarget) || 0, current: Number(goalCurrent) || 0, unit: '', owner: pb.authStore.record.id });
        setGoalTitle(''); setGoalTarget(''); setGoalCurrent(''); load();
    };

    const renderTimeProgress = (title, type, series, emptyText) => {
        const latest = series[series.length - 1];
        const best = series.length ? Math.min(...series.map((x) => x.seconds)) : 0;
        const latestGrade = latest ? gradeForTime(type, latest.seconds) : null;
        const bestGrade = best ? gradeForTime(type, best) : null;
        return (
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-extrabold">{title}</h2>
                        <p className="mt-1 text-sm text-slate-500">Evolució del temps total. Com menys, millor.</p>
                    </div>
                    {latest && <div className="text-right"><p className="text-xs font-bold text-slate-400">ÚLTIM</p><p className="text-xl font-extrabold">{formatTime(latest.seconds)}</p><p className="text-xs font-bold text-slate-600">Nota aprox. {latestGrade}</p></div>}
                </div>
                {series.length ? (
                    <>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">MILLOR TEMPS</p><p className="text-lg font-extrabold">{formatTime(best)}</p><p className="text-xs text-slate-500">Nota aprox. {bestGrade}</p></div>
                            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">ÚLTIM</p><p className="text-lg font-extrabold">{formatTime(latest.seconds)}</p><p className="text-xs text-slate-500">{latest.fullDate}</p></div>
                        </div>
                        <div className="mt-4 h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={series}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="date" fontSize={12} />
                                    <YAxis tickFormatter={formatTime} fontSize={12} />
                                    <Tooltip formatter={(value) => [formatTime(value), 'Temps']} />
                                    <Line type="monotone" dataKey="seconds" name="Temps" stroke={TYPES[type].color} strokeWidth={3} dot />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                ) : <p className="mt-4 text-sm text-slate-400">{emptyText}</p>}
            </section>
        );
    };

    return (
        <AppShell title="El meu progrés">
            <Helmet>
                <title>El meu progrés — BOMBER TRAINER</title>
                <meta name="description" content="Millors marques, evolució de temps, gràfiques de pes corporal i objectius de l'opositor." />
            </Helmet>

            {loadError && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{loadError}</div>}

            <section className="grid grid-cols-3 gap-3">
                {[['Punts', points], ['Ratxa', `${streak(sessions)} d`], ['Nivell', levelFor(points).name]].map(([k, v]) => (
                    <div key={k} className="rounded-3xl bg-white border border-slate-200 p-4 text-center shadow-sm">
                        <p className="text-xs font-bold tracking-widest text-slate-400">{k.toUpperCase()}</p>
                        <p className="mt-1 text-lg font-extrabold">{v}</p>
                    </div>
                ))}
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Calendari del mes</h2>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
                    {['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'].map((d) => <span key={d}>{d}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                    {cells.map((c, i) => (
                        <div key={c ? c.key : `e${i}`} className="flex h-10 items-center justify-center rounded-lg text-sm font-bold" style={{ backgroundColor: c?.type ? TYPES[c.type]?.soft || '#e2e8f0' : '#f8fafc', color: c?.type ? TYPES[c.type]?.color || '#475569' : '#94a3b8' }}>
                            {c ? c.day : ''}
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Millors marques</h2>
                <p className="mt-2 text-sm text-slate-600">Press banca: <strong>{bestBench || '—'} kg</strong></p>
                <p className="text-sm text-slate-600">Sessions registrades: <strong>{sessions.length}</strong></p>
            </section>

            {renderTimeProgress('Incendi urbà / estructural', 'estructural', structuralTimes, 'Registra un incendi urbà per veure la progressió.')}
            {renderTimeProgress('Incendi forestal', 'forestal', forestalTimes, 'Registra un incendi forestal per veure la progressió.')}

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Evolució de manteniment</h2>
                <p className="mt-1 text-sm text-slate-500">Sèries registrades i volum total per sessió.</p>
                <div className="mt-4 h-48">
                    {maintenanceSeries.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={maintenanceSeries}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="date" fontSize={12} />
                                <YAxis fontSize={12} />
                                <Tooltip />
                                <Line type="monotone" dataKey="total" name="Total" stroke="#ca8a04" strokeWidth={3} dot />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <p className="text-sm text-slate-400">Registra sèries com 15/15/12 per veure'n l'evolució.</p>}
                </div>
                {maintenanceSeries.length > 0 && (
                    <ul className="mt-4 space-y-2">
                        {maintenanceSeries.slice(-8).reverse().map((entry) => (
                            <li key={`${entry.date}-${entry.values.join('-')}`} className="flex items-center justify-between rounded-xl bg-yellow-50 px-4 py-3 text-sm">
                                <div><span className="font-semibold">{entry.date}</span>{entry.entries?.length > 0 && <div className="mt-1 space-y-0.5 text-xs font-medium text-slate-600">{entry.entries.map((exercise) => <p key={`${entry.date}-${exercise.exercici}`}>{exercise.exercici}: {exercise.values.join(' / ')}</p>)}</div>}</div>
                                <span className="ml-3 shrink-0 text-right font-bold">Total {entry.total}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Pes corporal</h2>
                <form onSubmit={addWeight} className="mt-3 flex flex-wrap gap-2">
                    <input required type="number" step="0.1" placeholder="Pes (kg)" value={w} onChange={(e) => setW(e.target.value)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-3" />
                    <input type="number" step="0.1" placeholder="% greix" value={fat} onChange={(e) => setFat(e.target.value)} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-3" />
                    <button type="submit" className="min-h-[48px] rounded-xl bg-slate-900 px-5 font-bold text-white">Guardar</button>
                </form>
                <div className="mt-4 h-48">
                    {weightSeries.length ? (
                        <ResponsiveContainer width="100%" height="100%"><LineChart data={weightSeries}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" fontSize={12} /><YAxis domain={['dataMin - 2', 'dataMax + 2']} fontSize={12} /><Tooltip /><Line type="monotone" dataKey="pes" stroke="#2563eb" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>
                    ) : <p className="text-sm text-slate-400">Registra el teu pes per veure l'evolució dels últims 30 dies.</p>}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Objectius</h2>
                <form onSubmit={addGoal} className="mt-3 grid gap-2 sm:grid-cols-4">
                    <input required placeholder="Press banca 65kg x20" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 sm:col-span-2" />
                    <input type="number" placeholder="Objectiu" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" />
                    <input type="number" placeholder="Actual" value={goalCurrent} onChange={(e) => setGoalCurrent(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" />
                    <button type="submit" className="min-h-[48px] rounded-xl bg-slate-900 font-bold text-white sm:col-span-4">Afegir objectiu</button>
                </form>
                <ul className="mt-4 space-y-3">
                    {goals.length === 0 && <li className="text-sm text-slate-400">Cap objectiu establert.</li>}
                    {goals.map((g) => {
                        const pct = g.target ? Math.min(100, Math.round(((g.current || 0) / g.target) * 100)) : 0;
                        return <li key={g.id}><div className="flex justify-between text-sm font-semibold"><span>{g.title}</span><span>{pct}%</span></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-600" style={{ width: `${pct}%` }} /></div></li>;
                    })}
                </ul>
            </section>
        </AppShell>
    );
}
