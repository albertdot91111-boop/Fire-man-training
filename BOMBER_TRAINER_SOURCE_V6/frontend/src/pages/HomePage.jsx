import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { MOTIVATION, TYPES, levelFor, streak, totalPoints, weakPoints } from '@/lib/btData';
import { diagnoseBomberProgress } from '@/aiEngine';

const TODAY_ACTIONS = [
    { label: '🔥 ESPECÍFIC', to: '/entrena/estructural', type: 'estructural', detail: 'Incendi estructural · 16 kg + ninot 50 kg' },
    { label: '🌲 ESPECÍFIC', to: '/entrena/forestal', type: 'forestal', detail: 'Incendi forestal' },
    { label: '🌊 AQUÀTICA', to: '/entrena/aquatic', type: 'aquatic', detail: 'Prova INEFC · apnea · salvament · remolc' },
    { label: '🏋️ PRESS BANCA', to: '/entrena/pressbanca', type: 'pressbanca', detail: 'Pes · repeticions · sèries' },
    { label: '🟡 MANTENIMENT', to: '/entrena/manteniment', type: 'manteniment', detail: 'Tria 5, 10, 15 o 20 min i registra manualment el que facis' },
    { label: '⏸️ AVUI NO PUC ENTRENAR', to: '/entrena/descans', type: 'descans', detail: 'Registra el dia' },
];

function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function benchProgress(sessions) {
    const entries = sessions.flatMap((s) => Array.isArray(s.data) ? s.data : [])
        .filter((e) => String(e.exercici || '').toLowerCase().includes('press banca'));
    const values = entries.map((e) => ({ weight: Number(e.pes) || 0, reps: Number(e.repeticions) || Number(e.reps) || 0 })).filter((e) => e.weight > 0);
    if (!values.length) return null;
    const best = values.reduce((a, b) => (b.weight > a.weight ? b : a), values[0]);
    const weightPct = (best.weight / 65) * 100;
    const repPct = best.reps ? (best.reps / 20) * 100 : weightPct;
    return Math.round(Math.max(0, Math.min(100, Math.min(weightPct, repPct))));
}

export default function HomePage() {
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        const owner = pb.authStore.record?.id;
        if (!owner) { setSessions([]); return; }
        pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).then(setSessions).catch(() => setSessions([]));
    }, []);

    const diagnosis = useMemo(() => diagnoseBomberProgress(sessions), [sessions]);
    const points = totalPoints(sessions);
    const level = levelFor(points);
    const weak = useMemo(() => weakPoints(sessions), [sessions]);
    const motivation = MOTIVATION[sessions.length % MOTIVATION.length];
    const progressByType = useMemo(() => {
        const map = {};
        diagnosis.tests.forEach((test) => { map[test.type] = test.readiness?.progress ?? null; });
        map.pressbanca = benchProgress(sessions);
        return map;
    }, [diagnosis, sessions]);

    const actionDetail = (action) => {
        const pct = progressByType[action.type];
        if (pct !== null && pct !== undefined) return `${action.detail} · Progrés ${pct}%`;
        return action.detail;
    };

    return (
        <AppShell title="INICI">
            <Helmet><title>Inici — BOMBER TRAINER</title><meta name="description" content="Entrenaments i progrés diari per a opositors de Bombers." /></Helmet>

            <section className="grid grid-cols-3 gap-3" aria-label="Resum de progrés">
                {[
                    ['PUNTS', points],
                    ['RATXA', `${streak(sessions)} d`],
                    ['NIVELL', level.name],
                ].map(([label, value]) => <div key={label} className="rounded-3xl bg-white border border-slate-200 p-4 text-center shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold">{value}</p></div>)}
            </section>

            <section aria-labelledby="today-actions-heading">
                <div className="mb-3"><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PUNT DE PARTIDA</p><h2 id="today-actions-heading" className="mt-1 text-xl font-extrabold tracking-tight">Tria una acció per començar</h2></div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {TODAY_ACTIONS.map(({ label, to, type, detail }) => {
                        const t = TYPES[type];
                        const pct = progressByType[type];
                        const showProgress = ['estructural', 'forestal', 'aquatic', 'pressbanca'].includes(type);
                        return <Link key={to} to={to} aria-label={label} data-testid={`link-today-action-${type}`} className="group flex min-h-[112px] flex-col justify-between rounded-3xl border border-black/5 p-5 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}>
                            <div className="flex items-start justify-between gap-3"><p className="text-lg font-extrabold leading-tight tracking-tight">{label}</p>{showProgress && <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold" style={{ color: t.color }}>{pct === null || pct === undefined ? '—' : `${pct}%`}</span>}</div>
                            <p className="mt-3 text-xs font-semibold" style={{ color: t.color }}>{detail}</p>
                            {showProgress && pct !== null && pct !== undefined && <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} /></div>}
                        </Link>;
                    })}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">RESUM</p><p className="text-xl font-extrabold">La teva preparació</p></div><div className="text-right"><p className="text-xs font-bold tracking-widest text-slate-400">SESSIONS</p><p className="text-xl font-extrabold">{sessions.length}</p></div></div><p className="mt-3 text-sm font-medium text-slate-600">{motivation}</p></section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Punts febles detectats</h2>{weak.length === 0 ? <p className="mt-2 text-sm text-slate-500">Tot treballat aquesta setmana. Continua acumulant feina útil.</p> : <ul className="mt-3 space-y-2">{weak.map((w) => <li key={w.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold">{TYPES[w.type].label}</span><span className="text-sm text-slate-500">{w.days === null ? 'mai registrat' : `fa ${w.days} dies`}</span></li>)}</ul>}</section>
        </AppShell>
    );
}
