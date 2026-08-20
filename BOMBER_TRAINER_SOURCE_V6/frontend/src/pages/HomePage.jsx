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

const DAILY_OPTIONS = [
    { type: 'pressbanca', title: 'Press banca', detail: 'Força específica · treballa tècnica, càrrega i repeticions segons el teu nivell.', to: '/entrena/pressbanca' },
    { type: 'estructural', title: 'Específic estructural', detail: 'Treball específic de força i resistència per a la prova.', to: '/entrena/estructural' },
    { type: 'forestal', title: 'Circuit forestal', detail: 'Circuit específic amb control del temps i dels trams.', to: '/entrena/forestal' },
    { type: 'aquatic', title: 'Aquàtica', detail: 'Apnea, salvament i remolc segons la sessió disponible.', to: '/entrena/aquatic' },
    { type: 'manteniment', title: 'Manteniment', detail: 'Sessió flexible sense material obligatori.', to: '/entrena/manteniment' },
];

function daysSince(date) {
    if (!date) return 999;
    const d = new Date(date); const now = new Date();
    return Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000));
}

function buildDailyPlan(sessions) {
    const lastByType = {};
    sessions.forEach((s) => { if (!lastByType[s.type]) lastByType[s.type] = s; });
    return [...DAILY_OPTIONS].sort((a, b) => daysSince(lastByType[b.type]?.date) - daysSince(lastByType[a.type]?.date)).slice(0, 3);
}

function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const m = Math.floor(seconds / 60); const s = Math.round(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function HomePage() {
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        const owner = pb.authStore.record?.id;
        if (!owner) { setSessions([]); return; }
        pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).then(setSessions).catch(() => setSessions([]));
    }, []);

    const planItems = useMemo(() => buildDailyPlan(sessions), [sessions]);
    const diagnosis = useMemo(() => diagnoseBomberProgress(sessions), [sessions]);
    const points = totalPoints(sessions);
    const level = levelFor(points);
    const weak = useMemo(() => weakPoints(sessions), [sessions]);
    const motivation = MOTIVATION[sessions.length % MOTIVATION.length];

    return (
        <AppShell title="QUÈ PUC FER AVUI?">
            <Helmet><title>Què puc fer avui? — BOMBER TRAINER</title><meta name="description" content="Entrenaments diaris per a opositors de Bombers." /></Helmet>

            <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm" aria-labelledby="daily-plan-heading">
                <div><p className="text-xs font-bold tracking-[0.18em] text-slate-300">ENTRENAMENT D'AVUI</p><h2 id="daily-plan-heading" className="mt-1 text-2xl font-extrabold tracking-tight">La sessió te la proposa l'app</h2><p className="mt-2 text-sm text-slate-300">Es calcula automàticament segons el que fa més temps que no treballes.</p></div>
                {planItems.length > 0 ? <div className="mt-4 space-y-2">{planItems.map((item, i) => <Link key={`${item.type}-${i}`} to={item.to} className="block rounded-2xl bg-white/10 p-4 hover:bg-white/15"><div className="flex items-center justify-between gap-3"><span className="font-extrabold">{i + 1}. {item.title}</span><span className="text-xs font-bold text-slate-300">FER →</span></div><p className="mt-1 text-sm text-slate-300">{item.detail}</p></Link>)}</div> : <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm text-slate-300">Encara no hi ha prou dades per personalitzar la sessió.</div>}
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm" aria-labelledby="physical-progress-heading">
                <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PROGRÉS FÍSIC</p><h2 id="physical-progress-heading" className="mt-1 text-2xl font-extrabold tracking-tight">Preparació actual</h2></div><span className="text-sm font-bold text-slate-500">0% = sense registre · 100% = nivell 10</span></div>
                <div className="mt-4 space-y-4">
                    {diagnosis.tests.map((test) => {
                        const pct = test.readiness?.progress ?? 0;
                        const time = formatSeconds(test.latestTimeSeconds);
                        return <div key={test.type}><div className="mb-1 flex items-center justify-between gap-3"><span className="font-bold">{test.label}</span><span className="font-extrabold">{test.readiness ? `${pct}%` : '—'}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-3 rounded-full bg-slate-900 transition-all" style={{ width: `${pct}%` }} /></div><p className="mt-1 text-xs text-slate-500">{time === '—' ? 'Sense registre' : `Últim temps: ${time}`} {test.readiness?.target ? `· referència orientativa: ${formatSeconds(test.readiness.target)}` : '· sense barem numèric configurat'}</p></div>;
                    })}
                </div>
                <p className="mt-4 text-xs text-slate-500">El percentatge és una orientació del projecte, no un barem oficial. La navette no es calcula ni es mostra fins que hi hagi confirmació oficial.</p>
            </section>

            <section aria-labelledby="today-actions-heading"><div className="mb-3 flex items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PUNT DE PARTIDA</p><h2 id="today-actions-heading" className="mt-1 text-xl font-extrabold tracking-tight">Tria una acció per començar</h2></div><span className="hidden shrink-0 text-xs font-bold text-slate-400 sm:block">AVUI</span></div><div className="grid gap-3 sm:grid-cols-2">{TODAY_ACTIONS.map(({ label, to, type, detail }) => { const t = TYPES[type]; return <Link key={to} to={to} aria-label={label} data-testid={`link-today-action-${type}`} className="group flex min-h-[92px] flex-col justify-between rounded-3xl border border-black/5 p-5 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}><p className="text-lg font-extrabold leading-tight tracking-tight">{label}</p><p className="mt-3 text-xs font-semibold" style={{ color: t.color }}>{detail}</p></Link>; })}</div></section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">RATXA</p><p className="text-4xl font-extrabold">{streak(sessions)} <span className="text-base font-semibold text-slate-400">dies</span></p></div><div className="text-right"><p className="text-xs font-bold tracking-widest text-slate-400">NIVELL</p><p className="text-xl font-extrabold">{level.name}</p><p className="text-sm text-slate-500">{points} punts</p></div></div><p className="mt-3 text-sm font-medium text-slate-600">{motivation}</p></section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Punts febles detectats</h2>{weak.length === 0 ? <p className="mt-2 text-sm text-slate-500">Tot treballat aquesta setmana. Continua acumulant feina útil.</p> : <ul className="mt-3 space-y-2">{weak.map((w) => <li key={w.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold">{TYPES[w.type].label}</span><span className="text-sm text-slate-500">{w.days === null ? 'mai registrat' : `fa ${w.days} dies`}</span></li>)}</ul>}</section>
        </AppShell>
    );
}
