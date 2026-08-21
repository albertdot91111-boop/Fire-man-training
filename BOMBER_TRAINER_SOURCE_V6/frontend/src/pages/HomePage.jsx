import React, { useEffect, useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { MOTIVATION, TYPES, levelFor, streak, totalPoints, weakPoints, today } from '@/lib/btData';
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

// Una sessió parcial serveix per a gràfiques/evolució, però no entra al % principal.
const PRESS_BENCH_TARGET_KG = 65;
const PRESS_BENCH_TARGET_REPS = 20;

function isCompleteBenchSession(session) {
    if (String(session?.type || '').trim().toLowerCase() !== 'pressbanca') return false;
    const data = Array.isArray(session?.data) ? session.data : [];
    const entry = data.find((e) => String(e?.exercici || '').trim().toLowerCase() === 'press banca');
    if (!entry) return false;
    const weight = Number(entry.pes);
    const reps = Number(entry.reps ?? entry.repeticions);
    const series = Number(entry.series);
    return Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0 && Number.isFinite(series) && series > 0;
}

function benchProgress(sessions) {
    const complete = sessions.filter(isCompleteBenchSession);
    if (!complete.length) return null;
    const values = complete.flatMap((s) => (Array.isArray(s.data) ? s.data : [])
        .filter((e) => String(e?.exercici || '').trim().toLowerCase() === 'press banca')
        .map((e) => ({ weight: Number(e.pes) || 0, reps: Number(e.reps ?? e.repeticions) || 0 })));
    if (!values.length) return null;
    const best = values.reduce((a, b) => {
        const aScore = Math.min(a.weight / PRESS_BENCH_TARGET_KG, a.reps / PRESS_BENCH_TARGET_REPS);
        const bScore = Math.min(b.weight / PRESS_BENCH_TARGET_KG, b.reps / PRESS_BENCH_TARGET_REPS);
        return bScore > aScore ? b : a;
    }, values[0]);
    return Math.round(Math.max(0, Math.min(100,
        Math.min((best.weight / PRESS_BENCH_TARGET_KG) * 100, (best.reps / PRESS_BENCH_TARGET_REPS) * 100))));
}

const STRUCTURAL_EXERCISES = [
    '1. Discos (transport)',
    '2. Kettlebells',
    '3. Trineu',
    '4. Recorregut en C',
    '5. Arrossegament de maniquí',
    '6. Esprint final',
];

const AQUATIC_EXERCISES = [
    '1. Entrada segura',
    '2. Apnea',
    '3. Batuda / bicicleta',
    '4. Estil lliure sota corxeres',
    '5. Crol de salvament',
    '6. Remolc de maniquí',
];

function parseProgressSeconds(value) {
    if (typeof value === 'number') return value > 0 ? value : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':');
        const mm = Number(m); const ss = Number(s);
        return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : 0;
    }
    if (/^\d+\s*,\s*\d{1,2}$/.test(text)) {
        const [m, s] = text.split(',').map((part) => Number(part.trim()));
        return Number.isFinite(m) && Number.isFinite(s) && s < 60 ? m * 60 + s : 0;
    }
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n * 60 : 0;
}

function isCompleteTimedSession(session, type, requiredExercises) {
    if (String(session?.type || '').trim().toLowerCase() !== type) return false;
    const data = Array.isArray(session?.data) ? session.data : [];
    return requiredExercises.every((name) => {
        const entry = data.find((e) => String(e?.exercici || '').trim().toLowerCase() === name.toLowerCase());
        return parseProgressSeconds(entry?.temps) > 0;
    });
}

function isCompleteStructuralSession(session) {
    return isCompleteTimedSession(session, 'estructural', STRUCTURAL_EXERCISES);
}

function isCompleteAquaticSession(session) {
    return isCompleteTimedSession(session, 'aquatic', AQUATIC_EXERCISES);
}

// Estructural i aquàtica segueixen ara exactament la mateixa regla que forestal:
// parcial = gràfica/evolució; completa = pot entrar al % principal.
function physicalProgress(sessions, type) {
    // Referències orientatives del projecte, no barems oficials.
    const targets = { estructural: 130, forestal: 190, aquatic: 190 };
    const target = targets[type];
    if (!target) return null;
    const completeCheck = type === 'estructural'
        ? isCompleteStructuralSession
        : type === 'aquatic'
            ? isCompleteAquaticSession
            : () => true;
    const rows = sessions
        .filter((s) => String(s?.type || '').trim().toLowerCase() === type)
        .filter(completeCheck)
        .map((s) => {
            let seconds = Number(s?.duration) > 0 ? Number(s.duration) * 60 : 0;
            if (!seconds || type === 'estructural' || type === 'aquatic') {
                const data = Array.isArray(s?.data) ? s.data : [];
                seconds = data.map((e) => parseProgressSeconds(e?.temps)).reduce((sum, value) => sum + value, 0);
            }
            const penalties = Number(s?.penalties) || 0;
            const penaltySeconds = type === 'aquatic' ? penalties * 10 : type === 'estructural' ? penalties * 5 : penalties * 10;
            return seconds > 0 ? seconds + penaltySeconds : 0;
        })
        .filter((seconds) => seconds > 0);
    if (!rows.length) return null;
    const latest = rows[rows.length - 1];
    return Math.round(Math.max(0, Math.min(100, (1 - (latest - target) / target) * 100)));
}

export default function HomePage() {
    const [sessions, setSessions] = useState([]);
    const [coachPrompt, setCoachPrompt] = useState(null);
    const [manualCoachOpen, setManualCoachOpen] = useState(false);
    const [notifications, setNotifications] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
    const navigate = useNavigate();
    const loadSessions = () => {
        const owner = pb.authStore.record?.id;
        if (!owner) { setSessions([]); return; }
        pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).then(setSessions).catch(() => setSessions([]));
    };
    useEffect(() => { loadSessions(); }, []);
    const hasTodayTraining = useMemo(() => sessions.some((s) => s.date === today() && s.type !== 'descans'), [sessions]);
    useEffect(() => {
        if (hasTodayTraining) { markCoachCompleted(); setCoachPrompt(null); return undefined; }
        let cancelled = false;
        const check = async () => {
            if (cancelled) return;
            const result = shouldCoachPrompt({ hasTodayTraining });
            if (!result.prompt) return;
            setCoachPrompt({ kind: result.kind, state: result.state });
            await showCoachNotification(result.kind === 'second' ? '⚠️ Encara no has entrenat avui' : '🔥 Ei! Avui què toca?', result.kind === 'second' ? 'Circuit · Pit · Manteniment. O marca «Avui no puc». Tu tries, però fes alguna cosa útil.' : 'Tria Circuit, Pit o Manteniment i registra-ho quan acabis.');
        };
        check();
        const ms = nextCoachCheckMs({ hasTodayTraining });
        const timer = ms === null ? null : window.setTimeout(check, Math.max(1000, ms));
        const refresh = window.setInterval(check, 60 * 1000);
        return () => { cancelled = true; if (timer) window.clearTimeout(timer); window.clearInterval(refresh); };
    }, [hasTodayTraining]);
    const choose = (key) => { chooseCoachOption(key); const option = COACH_OPTIONS.find((item) => item.key === key); if (option) navigate(option.to); setManualCoachOpen(false); };
    const handleUnavailable = () => { markCoachUnavailable(); setCoachPrompt(null); setManualCoachOpen(false); };
    const enableNotifications = async () => { setNotifications(await requestCoachNotifications()); };
    const openCoachManually = () => { setManualCoachOpen(true); setCoachPrompt({ kind: 'manual', state: getTodayCoachState() }); };
    const diagnosis = useMemo(() => diagnoseBomberProgress(sessions), [sessions]);
    const points = totalPoints(sessions); const level = levelFor(points); const weak = useMemo(() => weakPoints(sessions), [sessions]); const currentStreak = streak(sessions); const motivation = MOTIVATION[sessions.length % MOTIVATION.length];
    const progressByType = useMemo(() => {
        const map = {};
        diagnosis.tests.forEach((test) => { map[test.type] = test.readiness?.progress ?? null; });
        ['estructural', 'forestal', 'aquatic'].forEach((type) => {
            const direct = physicalProgress(sessions, type);
            if (direct !== null) map[type] = direct;
            else map[type] = null;
        });
        map.pressbanca = benchProgress(sessions);
        return map;
    }, [diagnosis, sessions]);

    return (
        <AppShell title="INICI">
            <Helmet><title>Inici — BOMBER TRAINER</title><meta name="description" content="Entrenaments i progrés diari per a opositors de Bombers." /></Helmet>
            {(coachPrompt || manualCoachOpen) && !hasTodayTraining && <section className="rounded-3xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-white p-5 shadow-sm" aria-labelledby="daily-coach-heading">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-yellow-700">ENTRENADOR DIARI</p><h2 id="daily-coach-heading" className="mt-1 text-xl font-extrabold tracking-tight">🔥 Ei! Avui què toca?</h2><p className="mt-2 text-sm font-medium text-slate-600">{getCoachMotivation(new Date().getDate())}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-slate-600 shadow-sm">RATXA {currentStreak} d</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">{COACH_OPTIONS.map((option) => <button key={option.key} type="button" onClick={() => choose(option.key)} className="min-h-[64px] rounded-2xl bg-slate-900 px-3 py-2 text-left font-extrabold text-white shadow-sm active:scale-[0.985]"><span className="block">{option.label}</span><span className="mt-1 block text-xs font-medium text-slate-300">{option.detail}</span></button>)}</div>
                <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={handleUnavailable} className="min-h-[44px] rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700">⏸️ Avui no puc</button>{notifications !== 'granted' && notifications !== 'unsupported' && <button type="button" onClick={enableNotifications} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">🔔 Activar avisos</button>}</div>
                <p className="mt-3 text-xs font-medium text-slate-500">Pots obrir aquest entrenador manualment quan vulguis. Si tries una opció i en 6 hores encara no hi ha cap sessió registrada, et tornaré a avisar. Si marques «Avui no puc», avui no insistiré.</p>
            </section>}
            {!hasTodayTraining && !coachPrompt && !manualCoachOpen && <button type="button" onClick={openCoachManually} className="w-full rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-4 text-left shadow-sm"><span className="block text-xs font-bold tracking-[0.18em] text-yellow-700">ENTRENADOR DIARI</span><span className="mt-1 block text-lg font-extrabold">🔥 Obrir entrenador ara</span><span className="mt-1 block text-sm text-slate-600">No cal esperar la notificació.</span></button>}
            {hasTodayTraining && <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm"><p className="text-xs font-bold tracking-[0.18em] text-green-700">AVUI FET</p><h2 className="mt-1 text-xl font-extrabold">🔥 Molt bé. Sessió registrada.</h2><p className="mt-2 text-sm font-medium text-slate-700">{currentStreak > 1 ? `Ratxa activa: ${currentStreak} dies seguits. No la trenquis.` : 'Primera passa feta. Demà tornem-hi.'}</p></section>}
            <section className="grid grid-cols-3 gap-3" aria-label="Resum de progrés">{[['PUNTS', points], ['RATXA', `${currentStreak} d`], ['NIVELL', level.name]].map(([label, value]) => <div key={label} className="rounded-3xl bg-white border border-slate-200 p-4 text-center shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold">{value}</p></div>)}</section>
            <section aria-labelledby="today-actions-heading"><div className="mb-3"><p className="text-xs font-bold tracking-[0.18em] text-slate-400">PUNT DE PARTIDA</p><h2 id="today-actions-heading" className="mt-1 text-xl font-extrabold tracking-tight">Tria una acció per començar</h2></div><div className="grid gap-3 sm:grid-cols-2">{TODAY_ACTIONS.map(({ label, to, type, detail }) => { const t = TYPES[type]; const pct = progressByType[type]; const showProgress = ['estructural', 'forestal', 'aquatic', 'pressbanca'].includes(type); return <Link key={to} to={to} aria-label={label} data-testid={`link-today-action-${type}`} className="group flex min-h-[112px] flex-col justify-between rounded-3xl border border-black/5 p-5 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}><div className="flex items-start justify-between gap-3"><p className="text-lg font-extrabold leading-tight tracking-tight">{label}</p>{showProgress && <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold" style={{ color: t.color }}>{pct === null || pct === undefined ? '—' : `${pct}%`}</span>}</div><p className="mt-3 text-xs font-semibold" style={{ color: t.color }}>{detail}</p>{showProgress && pct !== null && pct !== undefined && <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} /></div>}</Link>; })}</div></section>
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-xs font-bold tracking-widest text-slate-400">RESUM</p><p className="text-xl font-extrabold">La teva preparació</p></div><div className="text-right"><p className="text-xs font-bold tracking-widest text-slate-400">SESSIONS</p><p className="text-xl font-extrabold">{sessions.length}</p></div></div><p className="mt-3 text-sm font-medium text-slate-600">{motivation}</p></section>
            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Punts febles detectats</h2>{weak.length === 0 ? <p className="mt-2 text-sm text-slate-500">Tot treballat aquesta setmana. Continua acumulant feina útil.</p> : <ul className="mt-3 space-y-2">{weak.map((w) => <li key={w.type} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="font-semibold">{TYPES[w.type].label}</span><span className="text-sm text-slate-500">{w.days === null ? 'mai registrat' : `fa ${w.days} dies`}</span></li>)}</ul>}</section>
        </AppShell>
    );
}
