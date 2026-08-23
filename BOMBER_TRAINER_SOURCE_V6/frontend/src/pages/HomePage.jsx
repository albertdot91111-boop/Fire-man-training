import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { MOTIVATION, TYPES, levelFor, streak, totalPoints, weakPoints, today, gradeForBench, gradeForTime, formatTime } from '@/lib/btData';
import { diagnoseBomberProgress } from '@/aiEngine';
import { COACH_OPTIONS, chooseCoachOption, getCoachMotivation, getTodayCoachState, markCoachCompleted, markCoachUnavailable, nextCoachCheckMs, requestCoachNotifications, shouldCoachPrompt, showCoachNotification } from '@/lib/dailyCoachReminder';

const TODAY_ACTIONS = [
    { label: '🔥 ESPECÍFIC', to: '/entrena/estructural', type: 'estructural', detail: 'Incendi estructural · 16 kg + ninot 50 kg' },
    { label: '🌲 ESPECÍFIC', to: '/entrena/forestal', type: 'forestal', detail: 'Incendi forestal' },
    { label: '🌊 AQUÀTICA', to: '/entrena/aquatic', type: 'aquatic', detail: 'Prova INEFC · apnea · salvament · remolc' },
    { label: '🏋️ PRESS BANCA', to: '/entrena/pressbanca', type: 'pressbanca', detail: 'Pes · repeticions · sèries' },
    { label: '🟡 MANTENIMENT', to: '/entrena/manteniment', type: 'manteniment', detail: 'Tria 5, 10, 15 o 20 min i registra manualment el que facis' },
    { label: '⏸️ AVUI NO PUC ENTRENAR', to: '/entrena/descans', type: 'descans', detail: 'Registra el dia' },
];

function benchProgress(sessions) {
    const values = sessions.flatMap((s) => {
        if (String(s?.type || '').trim().toLowerCase() !== 'pressbanca') return [];
        return (Array.isArray(s.data) ? s.data : [])
            .filter((e) => String(e?.exercici || '').trim().toLowerCase() === 'press banca')
            .map((e) => ({ weight: Number(e.pes) || 0, reps: Number(e.reps ?? e.repeticions) || 0, timeSeconds: Number(e.temps) || 0 }))
            .filter((e) => e.weight > 0 && e.reps > 0 && e.timeSeconds > 0);
    });
    if (!values.length) return null;
    const scored = values.map((value) => ({ ...value, grade: gradeForBench(value.weight, value.reps, value.timeSeconds) })).filter((value) => Number.isFinite(value.grade));
    if (!scored.length) return null;
    const best = scored.reduce((a, b) => b.grade > a.grade ? b : a, scored[0]);
    return { ...best, percent: Math.round(Math.max(0, Math.min(100, best.grade * 10))) };
}

const STRUCTURAL_EXERCISES = ['1. Discos (transport)', '2. Kettlebells', '3. Trineu', '4. Recorregut en C', '5. Arrossegament de maniquí', '6. Esprint final'];
const AQUATIC_EXERCISES = ['1. Entrada segura', '2. Apnea', '3. Batuda / bicicleta', '4. Estil lliure sota corxeres', '5. Crol de salvament', '6. Remolc de maniquí'];

function parseProgressSeconds(value) {
    if (typeof value === 'number') return value > 0 ? value : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':'); const mm = Number(m); const ss = Number(s);
        return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : 0;
    }
    if (/^\d+\s*,\s*\d{1,2}$/.test(text)) {
        const [m, s] = text.split(',').map((part) => Number(part.trim()));
        return Number.isFinite(m) && Number.isFinite(s) && s < 60 ? m * 60 + s : 0;
    }
    const n = Number(text); return Number.isFinite(n) && n > 0 ? n * 60 : 0;
}

function isCompleteTimedSession(session, type, requiredExercises) {
    if (String(session?.type || '').trim().toLowerCase() !== type) return false;
    const data = Array.isArray(session?.data) ? session.data : [];
    return requiredExercises.every((name) => {
        const entry = data.find((e) => String(e?.exercici || '').trim().toLowerCase() === name.toLowerCase());
        return parseProgressSeconds(entry?.temps) > 0;
    });
}

function isCompleteStructuralSession(session) { return isCompleteTimedSession(session, 'estructural', STRUCTURAL_EXERCISES); }
function isCompleteAquaticSession(session) { return isCompleteTimedSession(session, 'aquatic', AQUATIC_EXERCISES); }

function latestTimedSummary(sessions, type) {
    const required = type === 'estructural' ? STRUCTURAL_EXERCISES : AQUATIC_EXERCISES;
    const complete = sessions.find((s) => isCompleteTimedSession(s, type, required));
    if (!complete) return { complete: 0, total: required.length, time: 0 };
    const data = Array.isArray(complete.data) ? complete.data : [];
    const time = required.map((name) => data.find((e) => String(e?.exercici || '').trim().toLowerCase() === name.toLowerCase())).map((e) => parseProgressSeconds(e?.temps)).reduce((a, b) => a + b, 0);
    return { complete: required.length, total: required.length, time };
}

function physicalProgress(sessions, type) {
    const targets = { estructural: 130, aquatic: 190 };
    const target = targets[type];
    if (!target) return null;
    const completeCheck = type === 'estructural' ? isCompleteStructuralSession : isCompleteAquaticSession;
    const rows = sessions.filter((s) => String(s?.type || '').trim().toLowerCase() === type).filter(completeCheck).map((s) => {
        const data = Array.isArray(s?.data) ? s.data : [];
        const seconds = data.map((e) => parseProgressSeconds(e?.temps)).reduce((sum, value) => sum + value, 0);
        const penalties = Number(s?.penalties) || 0;
        const penaltySeconds = type === 'aquatic' ? penalties * 10 : penalties * 5;
        return seconds > 0 ? seconds + penaltySeconds : 0;
    }).filter((seconds) => seconds > 0);
    if (!rows.length) return null;
    const latest = rows[rows.length - 1];
    return Math.round(Math.max(0, Math.min(100, (1 - (latest - target) / target) * 100)));
}

function metricNumber(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; }

function latestWearableSummary(sessions) {
    const session = sessions.find((s) => s?.wearable && metricNumber(s.wearable.durationSeconds));
    if (!session) return null;
    const w = session.wearable; const duration = metricNumber(w.durationSeconds);
    const distanceKm = metricNumber(w.distanceKm) || (metricNumber(w.distanceMeters) ? metricNumber(w.distanceMeters) / 1000 : null);
    const heartAverage = metricNumber(w.heartRate?.average); const paceSeconds = duration && distanceKm ? duration / distanceKm : null;
    const pace = paceSeconds && paceSeconds <= 3600 ? `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/km` : null;
    const mm = Math.floor(duration / 60); const ss = Math.round(duration % 60);
    return { date: String(session.date || '').slice(0, 10), text: [`${mm}:${String(ss).padStart(2, '0')}`, distanceKm ? `${distanceKm.toFixed(2)} km` : null, pace, heartAverage ? `FC ${Math.round(heartAverage)} bpm` : null].filter(Boolean).join(' · ') };
}

function ForestalHomeProgress({ sessions }) {
    const session = sessions.find((s) => String(s?.type || '').trim().toLowerCase() === 'forestal');
    const data = Array.isArray(session?.data) ? session.data : [];
    const circuit = data.find((e) => String(e?.exercici || '').trim().toUpperCase() === 'CIRCUIT COMPLET') || {};
    const trams = [
        { label: 'T1', time: Number(circuit.tram1) || 0, percent: Number(circuit.tram1Percentatge) || 0 },
        { label: 'T2', time: Number(circuit.tram2) || 0, percent: Number(circuit.tram2Percentatge) || 0 },
        { label: 'T3', time: Number(circuit.tram3) || 0, percent: Number(circuit.tram3Percentatge) || 0 },
    ];
    const completed = trams.filter((tram) => tram.time > 0).length;
    const totalSeconds = trams.reduce((sum, tram) => sum + tram.time, 0);
    const globalPercent = completed === 3 ? Math.round(Math.max(0, Math.min(100, gradeForTime('forestal', totalSeconds) * 10))) : 0;
    return <div className="mt-2 rounded-xl bg-white/75 p-2 ring-1 ring-black/5">
        <div className="grid grid-cols-4 gap-1.5">
            {trams.map((tram) => <div key={tram.label} className="rounded-lg bg-orange-50 px-2 py-1.5 text-center"><p className="text-[10px] font-bold text-slate-500">{tram.label}</p><p className="text-sm font-extrabold text-slate-900">{tram.percent}%</p><p className="text-[10px] font-medium text-slate-500">{tram.time > 0 ? formatTime(tram.time) : '—'}</p></div>)}
            <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-center"><p className="text-[10px] font-bold text-slate-500">GLOBAL</p><p className="text-sm font-extrabold text-slate-900">{globalPercent}%</p><p className="text-[10px] font-medium text-slate-500">{completed}/3</p></div>
        </div>
    </div>;
}

function StructuralHomeProgress({ sessions, percent, color }) {
    const session = sessions.find((s) => String(s?.type || '').trim().toLowerCase() === 'estructural');
    const data = Array.isArray(session?.data) ? session.data : [];
    const items = STRUCTURAL_EXERCISES.map((name) => {
        const entry = data.find((e) => String(e?.exercici || '').trim().toLowerCase() === name.toLowerCase());
        const time = parseProgressSeconds(entry?.temps);
        const percentatge = time > 0 ? Math.round(Math.max(0, Math.min(100, gradeForTime('estructural', time) * 10))) : 0;
        return { label: name.replace(/^\d+\.\s*/, ''), time, percent: percentatge };
    });
    const completed = items.filter((item) => item.time > 0).length;
    const globalPercent = completed === items.length ? (percent ?? 0) : 0;
    return <div className="mt-2 rounded-xl bg-white/75 p-2 ring-1 ring-black/5">
        <div className="grid grid-cols-3 gap-1.5">
            {items.map((item) => <div key={item.label} className="rounded-lg bg-red-50 px-1.5 py-1 text-center">
                <p className="truncate text-[9px] font-bold text-slate-500">{item.label}</p>
                <p className="text-xs font-extrabold text-slate-900">{item.percent}%</p>
                <p className="text-[9px] font-medium text-slate-500">{item.time > 0 ? formatTime(item.time) : '—'}</p>
            </div>)}
        </div>
        <div className="mt-1.5 flex items-center justify-between rounded-lg bg-slate-100 px-2 py-1">
            <span className="text-[9px] font-bold text-slate-500">GLOBAL · {completed}/6</span>
            <span className="text-xs font-extrabold" style={{ color }}>{globalPercent}%</span>
        </div>
    </div>;
}

function CompactTimedProgress({ sessions, type, percent, color }) {
    if (type === 'estructural') return <StructuralHomeProgress sessions={sessions} percent={percent} color={color}/>;
    const summary = latestTimedSummary(sessions, type);
    return <div className="mt-2 rounded-xl bg-white/75 px-2.5 py-2 ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">GLOBAL</span>
            <span className="text-sm font-extrabold" style={{ color }}>{percent === null || percent === undefined ? '0%' : `${percent}%`}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-500"><span>{summary.complete}/{summary.total} exercicis</span><span>{summary.time > 0 ? formatTime(summary.time) : 'pendent'}</span></div>
    </div>;
}

function CompactBenchProgress({ bench }) {
    if (!bench) return null;
    return <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl bg-white/75 p-2 ring-1 ring-black/5">
        <div className="rounded-lg bg-violet-50 px-1.5 py-1 text-center"><p className="text-[9px] font-bold text-slate-500">KG</p><p className="text-xs font-extrabold">{bench.weight}</p></div>
        <div className="rounded-lg bg-violet-50 px-1.5 py-1 text-center"><p className="text-[9px] font-bold text-slate-500">REPS</p><p className="text-xs font-extrabold">{bench.reps}</p></div>
        <div className="rounded-lg bg-violet-50 px-1.5 py-1 text-center"><p className="text-[9px] font-bold text-slate-500">TEMPS</p><p className="text-xs font-extrabold">{formatTime(bench.timeSeconds)}</p></div>
        <div className="rounded-lg bg-slate-100 px-1.5 py-1 text-center"><p className="text-[9px] font-bold text-slate-500">GLOBAL</p><p className="text-xs font-extrabold">{bench.percent}%</p></div>
    </div>;
}

export default function HomePage() {
    const [sessions, setSessions] = useState([]);
    const [coachPrompt, setCoachPrompt] = useState(null);
    const [manualCoachOpen, setManualCoachOpen] = useState(false);
    const [notifications, setNotifications] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    const navigate = useNavigate();
    const loadSessions = () => { const owner = pb.authStore.record?.id; if (!owner) { setSessions([]); return; } pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).then(setSessions).catch(() => setSessions([])); };
    useEffect(() => { loadSessions(); }, []);
    const hasTodayTraining = useMemo(() => sessions.some((s) => s.date === today() && s.type !== 'descans'), [sessions]);
    useEffect(() => {
        if (hasTodayTraining) { markCoachCompleted(); setCoachPrompt(null); return undefined; }
        let cancelled = false;
        const check = async () => { if (cancelled) return; const result = shouldCoachPrompt({ hasTodayTraining }); if (!result.prompt) return; setCoachPrompt({ kind: result.kind, state: result.state }); await showCoachNotification(result.kind === 'second' ? '⚠️ Encara no has entrenat avui' : '🔥 Ei! Avui què toca?', result.kind === 'second' ? 'Circuit · Pit · Manteniment. O marca «Avui no puc». Tu tries, però fes alguna cosa útil.' : 'Tria Circuit, Pit o Manteniment i registra-ho quan acabis.'); };
        check(); const ms = nextCoachCheckMs({ hasTodayTraining }); const timer = ms === null ? null : window.setTimeout(check, Math.max(1000, ms)); const refresh = window.setInterval(check, 60 * 1000);
        return () => { cancelled = true; if (timer) window.clearTimeout(timer); window.clearInterval(refresh); };
    }, [hasTodayTraining]);
    const choose = (key) => { chooseCoachOption(key); const option = COACH_OPTIONS.find((item) => item.key === key); if (option) navigate(option.to); setManualCoachOpen(false); };
    const handleUnavailable = () => { markCoachUnavailable(); setCoachPrompt(null); setManualCoachOpen(false); };
    const enableNotifications = async () => { setNotifications(await requestCoachNotifications()); };
    const openCoachManually = () => { setManualCoachOpen(true); setCoachPrompt({ kind: 'manual', state: getTodayCoachState() }); };
    const diagnosis = useMemo(() => diagnoseBomberProgress(sessions), [sessions]);
    const points = totalPoints(sessions); const level = levelFor(points); const weak = useMemo(() => weakPoints(sessions), [sessions]); const currentStreak = streak(sessions); const motivation = MOTIVATION[sessions.length % MOTIVATION.length];
    const wearableSummary = useMemo(() => latestWearableSummary(sessions), [sessions]);
    const progressByType = useMemo(() => {
        const map = {};
        diagnosis.tests.forEach((test) => { map[test.type] = test.readiness?.progress ?? null; });
        ['estructural', 'forestal', 'aquatic'].forEach((type) => { if (type === 'forestal') { map[type] = null; return; } map[type] = physicalProgress(sessions, type); });
        map.pressbanca = benchProgress(sessions)?.percent ?? null;
        return map;
    }, [diagnosis, sessions]);
    const bench = useMemo(() => benchProgress(sessions), [sessions]);

    return (
        <AppShell title="INICI">
            <Helmet><title>Inici — BOMBER TRAINER</title><meta name="description" content="Entrenaments i progrés diari per a opositors de Bombers." /></Helmet>
            {(coachPrompt || manualCoachOpen) && !hasTodayTraining && <section className="rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-sm" aria-labelledby="daily-coach-heading"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-yellow-700">ENTRENADOR DIARI</p><h2 id="daily-coach-heading" className="mt-1 text-xl font-extrabold tracking-tight">🔥 Ei! Avui què toca?</h2><p className="mt-2 text-sm font-medium text-slate-600">{getCoachMotivation(new Date().getDate())}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-slate-600 shadow-sm">RATXA {currentStreak} d</span></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{COACH_OPTIONS.map((option) => <button key={option.key} type="button" onClick={() => choose(option.key)} className="min-h-[64px] rounded-2xl bg-slate-900 px-3 py-2 text-left font-extrabold text-white shadow-sm active:scale-[0.985]"><span className="block">{option.label}</span><span className="mt-1 block text-xs font-medium text-slate-300">{option.detail}</span></button>)}</div><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={handleUnavailable} className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700">⏸️ Avui no puc</button>{notifications !== 'granted' && notifications !== 'unsupported' && <button type="button" onClick={enableNotifications} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">🔔 Activar avisos</button>}</div><p className="mt-3 text-xs font-medium text-slate-500">Pots obrir aquest entrenador manualment quan vulguis. Si tries una opció i en 6 hores encara no hi ha cap sessió registrada, et tornaré a avisar. Si marques «Avui no puc», avui no insistiré.</p></section>}
            {!hasTodayTraining && !coachPrompt && !manualCoachOpen && <button type="button" onClick={openCoachManually} className="w-full rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4 text-left shadow-sm"><span className="block text-xs font-bold tracking-[0.18em] text-yellow-700">ENTRENADOR DIARI</span><span className="mt-1 block text-lg font-extrabold">🔥 Obrir entrenador ara</span><span className="mt-1 block text-sm text-slate-600">No cal esperar la notificació.</span></button>}
            {hasTodayTraining && <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.18em] text-green-700">AVUI FET</p><h2 className="mt-1 text-xl font-extrabold">🔥 Molt bé. Sessió registrada.</h2><p className="mt-2 text-sm font-medium text-slate-700">{currentStreak > 1 ? `Ratxa activa: ${currentStreak} dies seguits. No la trenquis.` : 'Primera passa feta. Demà tornem-hi.'}</p></section>}
            <section className="grid grid-cols-3 gap-3" aria-label="Resum de progrés">{[['PUNTS', points], ['RATXA', `${currentStreak} d`], ['NIVELL', level.name]].map(([label, value]) => <div key={label} className="rounded-3xl bg-white border border-slate-200 p-4 text-center shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold">{value}</p></div>)}</section>
            <section aria-labelledby="today-actions-heading"><div className="mb-3"><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PUNT DE PARTIDA</p><h2 id="today-actions-heading" className="mt-1 text-xl font-extrabold tracking-tight">Tria una acció per començar</h2></div><div className="grid gap-2 sm:grid-cols-2">{TODAY_ACTIONS.map(({ label, to, type, detail }) => { const t = TYPES[type]; const pct = progressByType[type]; const showProgress = ['estructural', 'aquatic', 'pressbanca'].includes(type); return <Link key={to} to={to} aria-label={label} data-testid={`link-today-action-${type}`} className="group flex min-h-[88px] flex-col justify-between rounded-2xl border border-black/5 p-3 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ backgroundColor: t.soft, borderLeft: `6px solid ${t.color}` }}><div className="flex items-start justify-between gap-2"><p className="text-base font-extrabold leading-tight tracking-tight">{label}</p>{showProgress && <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold" style={{ color: t.color }}>{pct === null || pct === undefined ? '—' : `${pct}%`}</span>}</div><p className="mt-1 text-[10px] font-semibold leading-tight" style={{ color: t.color }}>{detail}</p>{type === 'forestal' && <ForestalHomeProgress sessions={sessions}/>} {type === 'estructural' && <CompactTimedProgress sessions={sessions} type="estructural" percent={pct} color={t.color}/>} {type === 'aquatic' && <CompactTimedProgress sessions={sessions} type="aquatic" percent={pct} color={t.color}/>} {type === 'pressbanca' && <CompactBenchProgress bench={bench}/>} {showProgress && pct !== null && pct !== undefined && type !== 'pressbanca' && <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/70"><div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }}/></div>}</Link>; })}</div></section>
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">RESUM</p><p className="text-xl font-extrabold">La teva preparació</p></div><div className="text-right"><p className="text-xs font-bold tracking-widest text-slate-400">SESSIONS</p><p className="text-xl font-extrabold">{sessions.length}</p></div></div><p className="mt-3 text-sm font-medium text-slate-600">{motivation}</p>{wearableSummary && <p className="mt-2 text-xs font-semibold text-slate-500">Última activitat sincronitzada ({wearableSummary.date}): {wearableSummary.text}</p>}</section>
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Punts febles detectats</h2>{weak.length === 0 ? <p className="mt-2 text-sm text-slate-500">Tot treballat aquesta setmana. Continua acumulant feina útil.</p> : <ul className="mt-3 space-y-2">{weak.map((w) => <li key={w.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold">{TYPES[w.type].label}</span><span className="text-sm text-slate-500">{w.days === null ? 'mai registrat' : `fa ${w.days} dies`}</span></li>)}</ul>}</section>
        </AppShell>
    );
}
