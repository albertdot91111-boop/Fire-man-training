import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { MOTIVATION, TYPES, levelFor, nextLevel, streak, totalPoints, weakPoints } from '@/lib/btData';

const TODAY_ACTIONS = [
    { label: '🔥 ESPECÍFIC', to: '/entrena/estructural', type: 'estructural', detail: 'Incendi estructural · 16 kg + ninot 50 kg' },
    { label: '🌲 ESPECÍFIC', to: '/entrena/forestal', type: 'forestal', detail: 'Incendi forestal' },
    { label: '🌊 AQUÀTICA', to: '/entrena/aquatic', type: 'aquatic', detail: 'Prova INEFC · apnea · salvament · remolc' },
    { label: '🏋️ PRESS BANCA', to: '/entrena/pressbanca', type: 'pressbanca', detail: 'Pes · repeticions · sèries' },
    { label: '⚡ 20 MIN', to: '/entrena/manteniment?durada=20', type: 'manteniment', detail: 'Sessió directa · 4 sèries · sense material' },
    { label: '⏱️ 10 MIN', to: '/entrena/manteniment?durada=10', type: 'manteniment', detail: 'Sessió directa · 3 sèries · sense material' },
    { label: '🟡 MANTENIMENT', to: '/entrena/manteniment', type: 'manteniment', detail: 'Tria la durada i registra el que facis' },
    { label: '🤖 RECOMANACIÓ', to: '/ia', type: 'forestal', id: 'recomanacio', detail: 'Decideix per tu' },
    { label: '⏸️ AVUI NO PUC ENTRENAR', to: '/entrena/descans', type: 'descans', detail: 'Registra el dia' },
];

export default function HomePage() {
    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        const owner = pb.authStore.record?.id;
        if (!owner) {
            setSessions([]);
            return;
        }
        pb.collection('bt_sessions')
            .getFullList({ sort: '-date', filter: `owner = "${owner}"` })
            .then(setSessions)
            .catch(() => setSessions([]));
    }, []);

    const points = totalPoints(sessions);
    const level = levelFor(points);
    const next = nextLevel(points);
    const weak = useMemo(() => weakPoints(sessions), [sessions]);
    const motivation = MOTIVATION[sessions.length % MOTIVATION.length];

    return (
        <AppShell title="QUÈ PUC FER AVUI?">
            <Helmet>
                <title>Què puc fer avui? — BOMBER TRAINER</title>
                <meta name="description" content="Entrenaments diaris per a opositors de Bombers: incendi estructural, forestal, aquàtica, força i manteniment." />
            </Helmet>

            <section aria-labelledby="today-actions-heading">
                <div className="mb-3 flex items-end justify-between gap-4">
                    <div><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PUNT DE PARTIDA</p><h2 id="today-actions-heading" className="mt-1 text-xl font-extrabold tracking-tight">Tria una acció per començar</h2></div>
                    <span className="hidden shrink-0 text-xs font-bold text-slate-400 sm:block">AVUI</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {TODAY_ACTIONS.map(({ label, to, type, detail, id }) => {
                        const t = TYPES[type];
                        return <Link key={to} to={to} aria-label={label} data-testid={`link-today-action-${id || type}`} className="group flex min-h-[92px] flex-col justify-between rounded-3xl border border-black/5 p-5 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}><p className="text-lg font-extrabold leading-tight tracking-tight">{label}</p><p className="mt-3 text-xs font-semibold" style={{ color: t.color }}>{detail}</p></Link>;
                    })}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">RATXA</p><p className="text-4xl font-extrabold">{streak(sessions)} <span className="text-base font-semibold text-slate-400">dies</span></p></div><div className="text-right"><p className="text-xs font-bold tracking-widest text-slate-400">NIVELL</p><p className="text-xl font-extrabold">{level.name}</p><p className="text-sm text-slate-500">{points} punts</p></div></div>
                {next && <div className="mt-4 h-2 w-full rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-900" style={{ width: `${Math.min(100, Math.round((points / next.min) * 100))}%` }} /></div>}
                <p className="mt-3 text-sm font-medium text-slate-600">{motivation}</p>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Punts febles detectats</h2>
                {weak.length === 0 ? <p className="mt-2 text-sm text-slate-500">Tot treballat aquesta setmana. Continua acumulant feina útil.</p> : <ul className="mt-3 space-y-2">{weak.map((w) => <li key={w.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold">{TYPES[w.type].label}</span><span className="text-sm text-slate-500">{w.days === null ? 'mai registrat' : `fa ${w.days} dies`}</span></li>)}</ul>}
            </section>
        </AppShell>
    );
}
