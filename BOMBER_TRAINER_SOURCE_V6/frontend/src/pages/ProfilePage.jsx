import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { ArrowRight, Award, CalendarDays, Clock3, Flame, Settings, Target, Trophy, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { TYPES, LEVELS, levelFor, nextLevel, streak, totalPoints, formatTime } from '@/lib/btData';

const SPORT_META = [
    ['cames', 'Cames'],
    ['estructural', 'Estructural'],
    ['forestal', 'Forestal'],
    ['aquatic', 'Aquàtica'],
    ['pressbanca', 'Press banca'],
];

// The profile's accumulated training time and active days are preparation
// metrics, not general app-usage metrics. Running, cycling, maintenance, etc.
// can stay in the activity history but do not inflate these two counters.
const PREPARATION_TYPES = new Set(['forestal', 'estructural']);

function initials(record) {
    const name = String(record?.name || record?.fullName || record?.username || '').trim();
    const parts = name.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0] || record?.email || 'BT').slice(0, 2)).toUpperCase();
}

function daysSince(date) {
    if (!date) return null;
    const a = new Date(date);
    const b = new Date();
    return Math.max(0, Math.floor((b - a) / 86400000));
}

export default function ProfilePage() {
    const [sessions, setSessions] = useState([]);
    const [weights, setWeights] = useState([]);
    const [goals, setGoals] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const load = async () => {
            if (!pb.authStore.isValid || !pb.authStore.record?.id) return;
            try {
                const [s, w, g] = await Promise.all([
                    pb.collection('bt_sessions').getFullList({ sort: '-date' }),
                    pb.collection('bt_weights').getFullList({ sort: '-date' }),
                    pb.collection('bt_goals').getFullList({ sort: '-created' }),
                ]);
                if (active) { setSessions(s); setWeights(w); setGoals(g); setError(''); }
            } catch (err) {
                if (active) setError(err?.response?.message || err?.message || 'No s’han pogut carregar les dades.');
            } finally { if (active) setLoading(false); }
        };
        load();
        const unsubscribe = pb.authStore.onChange(() => load());
        return () => { active = false; unsubscribe?.(); };
    }, []);

    const record = pb.authStore.record || {};
    const points = totalPoints(sessions);
    const level = levelFor(points);
    const next = nextLevel(points);
    const progressToNext = next ? Math.min(100, Math.round(((points - level.min) / (next.min - level.min)) * 100)) : 100;
    const preparationSessions = useMemo(() => sessions.filter((s) => PREPARATION_TYPES.has(s.type)), [sessions]);
    const totalSeconds = useMemo(() => preparationSessions.reduce((sum, s) => sum + (Number(s.duration) || 0) * 60, 0), [preparationSessions]);
    const totalKm = useMemo(() => preparationSessions.reduce((sum, s) => sum + (Number(s.distance) || 0), 0), [preparationSessions]);
    const activeDays = useMemo(() => new Set(preparationSessions.map((s) => String(s.date || '').slice(0, 10))).size, [preparationSessions]);
    const latestWeight = weights[0];
    const bestBench = useMemo(() => sessions.reduce((best, s) => Math.max(best, ...(Array.isArray(s.data) ? s.data : []).filter((e) => String(e.exercici || '').toLowerCase().includes('press banca')).map((e) => Number(e.pes) || 0)), 0), [sessions]);
    const lastByType = useMemo(() => Object.fromEntries(SPORT_META.map(([type]) => [type, sessions.find((s) => s.type === type)])), [sessions]);
    const recent = sessions.filter((s) => s.type !== 'descans').slice(0, 4);

    return <AppShell title="El meu perfil">
        <Helmet><title>El meu perfil — BOMBER TRAINER</title><meta name="description" content="Perfil de l’opositor, estadístiques, objectius, marques i activitat de BOMBER TRAINER." /></Helmet>

        <section className="rounded-[2rem] bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-black shadow-sm">{initials(record)}</div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-[0.18em] text-slate-400">OPOSITOR BOMBER</p>
                        <h2 className="mt-1 text-2xl font-black truncate">{record.name || record.username || 'El meu perfil'}</h2>
                        <p className="text-sm text-slate-500 truncate">{record.email || 'Perfil personal'}</p>
                    </div>
                    <Link to="/configuracio" aria-label="Configuració" className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Settings className="h-5 w-5" /></Link>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-end justify-between gap-3">
                        <div><p className="text-xs font-bold tracking-widest text-slate-400">NIVELL</p><p className="mt-1 text-2xl font-black">{level.name}</p></div>
                        <div className="text-right"><p className="text-xs text-slate-500">{next ? `${next.min - points} punts per ${next.name}` : 'Nivell màxim'}</p><p className="text-sm font-extrabold">{points} punts</p></div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progressToNext}%` }} /></div>
                </div>
            </div>
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
                [CalendarDays, activeDays, 'dies actius'],
                [Clock3, formatTime(totalSeconds), 'temps entrenant'],
                [Flame, `${streak(sessions)} dies`, 'ratxa actual'],
                [Trophy, sessions.filter((s) => s.type !== 'descans').length, 'sessions registrades'],
            ].map(([Icon, value, label]) => <div key={label} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm"><Icon className="h-5 w-5 text-slate-400" /><p className="mt-2 text-xl font-black">{value}</p><p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p></div>)}
        </section>

        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">LES MEVES DADES</p><h2 className="mt-1 text-lg font-black">Resum d’entrenament</h2></div><UserRound className="h-5 w-5 text-slate-300" /></div>
            <p className="mt-2 text-xs text-slate-400">Temps i dies acumulats: només proves forestal i estructural. Les altres activitats es conserven a l’historial però no inflen aquests comptadors.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">DISTÀNCIA</p><p className="mt-1 text-xl font-black">{totalKm ? `${totalKm.toFixed(1)} km` : '—'}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">MILLOR PRESS BANCA</p><p className="mt-1 text-xl font-black">{bestBench ? `${bestBench} kg` : '—'}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">PES ACTUAL</p><p className="mt-1 text-xl font-black">{latestWeight?.weight ? `${latestWeight.weight} kg` : '—'}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">OBJECTIUS</p><p className="mt-1 text-xl font-black">{goals.length}</p></div>
            </div>
        </section>

        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">PROVES</p><h2 className="mt-1 text-lg font-black">Estat de preparació</h2></div><Target className="h-5 w-5 text-slate-300" /></div>
            <div className="mt-4 space-y-2">
                {SPORT_META.map(([type, label]) => {
                    const last = lastByType[type];
                    const age = daysSince(last?.date);
                    const color = TYPES[type]?.color || '#0f172a';
                    return <div key={type} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                        <span className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black text-white" style={{ background: color }}>{TYPES[type]?.short?.slice(0, 2)}</span>
                        <div className="min-w-0 flex-1"><p className="font-extrabold text-sm">{label}</p><p className="text-xs text-slate-500">{last ? `Últim entrenament: ${String(last.date).slice(0, 10)}` : 'Encara sense registres'}</p></div>
                        <span className={`text-xs font-bold ${age === null || age > 14 ? 'text-amber-600' : 'text-slate-500'}`}>{age === null ? 'Pendent' : age === 0 ? 'Avui' : `fa ${age} d`}</span>
                    </div>;
                })}
            </div>
        </section>

        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">ACTIVITAT</p><h2 className="mt-1 text-lg font-black">Últimes sessions</h2></div><Link to="/progres" className="text-xs font-extrabold text-slate-700 flex items-center gap-1">Veure tot <ArrowRight className="h-4 w-4" /></Link></div>
            {loading ? <p className="mt-4 text-sm text-slate-400">Carregant dades…</p> : recent.length ? <div className="mt-4 space-y-2">{recent.map((s) => <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3"><div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center"><Award className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-extrabold">{TYPES[s.type]?.label || s.type}</p><p className="text-xs text-slate-500">{String(s.date || '').slice(0, 10)} · {s.duration ? `${s.duration} min` : 'sessió registrada'}</p></div><p className="text-sm font-black">{s.points || 0} pt</p></div>)}</div> : <p className="mt-4 text-sm text-slate-400">Encara no hi ha sessions registrades.</p>}
        </section>

        {error && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    </AppShell>;
}
