import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import { useIntegratedAi } from '@/hooks/use-integrated-ai';
import { buildUserContext } from '@/lib/btData';
import { buildBomberAiContext, diagnoseBomberProgress, adjustedTime } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica' };
const BAREM10 = { forestal: 190, estructural: 130, aquatic: 190 };

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}
function clamp(n, a = 0, b = 10) { return Math.max(a, Math.min(b, n)); }
function grade(type, seconds) {
    const t10 = BAREM10[type];
    if (!t10 || !seconds || seconds <= 0) return null;
    return clamp(5 * (3 * t10 - seconds) / t10);
}
function typeSessions(sessions, type) {
    return (Array.isArray(sessions) ? sessions : []).filter((s) => s.type === type).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}
function forestalTram10Targets() {
    const total = 190;
    const loads = [16, 20, 24];
    const sum = loads.reduce((a, b) => a + b, 0);
    return loads.map((load) => Math.round(total * load / sum));
}
function extractTramTimes(session) {
    const data = Array.isArray(session?.data) ? session.data : [];
    return [0, 1, 2].map((i) => {
        const row = data.find((x) => String(x?.exercici || '').toLowerCase().includes(`tram ${i + 1}`));
        const value = row?.temps;
        if (typeof value === 'string' && value.includes(':')) {
            const [m, s] = value.split(':').map(Number);
            return Number.isFinite(m) && Number.isFinite(s) ? m * 60 + s : null;
        }
        const n = Number(value);
        return Number.isFinite(n) && n > 0 ? (n < 20 ? n * 60 : n) : null;
    });
}
function latestCompleteForest(sessions) {
    return typeSessions(sessions, 'forestal').slice().reverse().find((s) => extractTramTimes(s).every(Boolean)) || null;
}
function calculateForestTargets(sessions) {
    const target = forestalTram10Targets();
    const latest = latestCompleteForest(sessions);
    const actual = latest ? extractTramTimes(latest) : [null, null, null];
    return { totalTarget: 190, rows: target.map((seconds, i) => ({ tram: i + 1, target: seconds, actual: actual[i], delta: actual[i] ? actual[i] - seconds : null })) };
}
function safeDiagnosis(sessions) {
    try { return diagnoseBomberProgress(Array.isArray(sessions) ? sessions : []); }
    catch (e) { return { tests: [], priority: null, error: e?.message || 'No s’ha pogut analitzar les sessions.' }; }
}
function globalReadiness(sessions) {
    const diagnosis = safeDiagnosis(sessions);
    const scored = (diagnosis.tests || []).map((t) => ({ ...t, grade: grade(t.type, t.latestTimeSeconds) })).filter((t) => t.grade !== null);
    if (!scored.length) return { score: null };
    return { score: scored.reduce((sum, x) => sum + x.grade, 0) / scored.length };
}
function predictWeeks(sessions, type) {
    const rows = typeSessions(sessions, type).slice(-6).map((s) => { try { return adjustedTime(s); } catch { return 0; } }).filter((x) => x > 0);
    if (rows.length < 3) return null;
    const first = rows[0], last = rows[rows.length - 1], improvement = (first - last) / Math.max(1, rows.length - 1), target = BAREM10[type];
    if (improvement <= 0 || last <= target) return last <= target ? 0 : null;
    return clamp(Math.ceil((last - target) / improvement / 1.5), 1, 52);
}
function buildTodayPlan(focus, minutes, data) {
    const mins = Number(minutes) > 0 ? Number(minutes) : 45;
    const targetInfo = focus === 'forestal' ? calculateForestTargets(data.sessions) : null;
    const short = mins <= 30;
    let steps;
    if (focus === 'forestal') {
        const t = targetInfo.rows;
        steps = short ? ['Escalfament 6 min', `2 × Tram 1: objectiu ≤ ${formatTime(t[0].target)}`, `2 × Tram 2: objectiu ≤ ${formatTime(t[1].target)}`, '5 min recuperació'] : ['Escalfament 8 min', `3 × Tram 2 específic: objectiu ≤ ${formatTime(t[1].target)}`, `2 × Tram 3 controlat: objectiu ≤ ${formatTime(t[2].target)}`, '1 × circuit complet al 80–90%', '8 min recuperació'];
    } else if (focus === 'estructural') {
        steps = short ? ['Escalfament 6 min', '3 × bloc tècnic amb descans complet', '2 × arrossegament/empenyiment controlat', '5 min recuperació'] : ['Escalfament 10 min', '3 × circuit tècnic', '3 × arrossegament/empenyiment', '1 × circuit complet controlat', '10 min recuperació'];
    } else {
        steps = short ? ['Escalfament 8 min', '4 × 25 m tècnics', '2 × remolc controlat', '5 min recuperació'] : ['Escalfament 10 min', '4 × 25 m tècnics', '3 × treball de remolc', '1 × prova contínua controlada', '10 min recuperació'];
    }
    return { focus, focusName: LABELS[focus], minutes: mins, material: data.material?.length ? data.material.join(', ') : 'sense material registrat', steps, targetInfo };
}
function localCoachAnswer(question, data, minutes) {
    const diagnosis = safeDiagnosis(data.sessions);
    const tests = (diagnosis.tests || []).filter((t) => t.sessions > 0);
    const priority = diagnosis.priority;
    const lower = question.toLowerCase();
    if (lower.includes('com vaig')) {
        if (!tests.length) return '### Com vas ara\n\nEncara no tinc prou sessions cronometrades per valorar-te. Registra almenys una sessió de cada prova.';
        const readiness = globalReadiness(data.sessions);
        const lines = tests.map((t) => { const g = grade(t.type, t.latestTimeSeconds); const trend = t.trendSeconds == null ? '' : t.trendSeconds < 0 ? ` 🟢 ${Math.abs(Math.round(t.trendSeconds))} s més ràpid` : t.trendSeconds > 0 ? ` 🔴 ${Math.round(t.trendSeconds)} s més lent` : ' 🟡 estable'; return `• ${t.label}: últim ${formatTime(t.latestTimeSeconds)}, millor ${formatTime(t.bestTimeSeconds)}${g !== null ? ` · nota orientativa ${g.toFixed(1)}` : ''}${trend}`; });
        return `### Com vas ara\n\n${lines.join('\n')}\n\n**Preparació global orientativa:** ${readiness.score === null ? 'pendent' : `${readiness.score.toFixed(1)}/10`}\n\n**Prioritat:** ${priority ? LABELS[priority] : 'pendent de dades'}.`;
    }
    if (lower.includes('punts febles')) {
        if (!tests.length) return '### Punts febles\n\nEncara no puc detectar-los: necessito més sessions registrades.';
        const ranked = [...tests].sort((a, b) => (b.trendSeconds || 0) - (a.trendSeconds || 0));
        return `### Els teus punts febles\n\n${ranked.map((t, i) => `${i + 1}. **${t.label}** — ${t.trendSeconds > 0 ? `+${Math.round(t.trendSeconds)} s` : t.trendSeconds < 0 ? `millora ${Math.abs(Math.round(t.trendSeconds))} s` : 'estable'}`).join('\n')}\n\n**Prioritat:** ${priority ? LABELS[priority] : 'pendent'}.`;
    }
    if (lower.includes('millorar')) {
        if (!priority) return '### Què milloraria primer\n\nEncara no hi ha prou dades per establir una prioritat.';
        const roadmap = predictWeeks(data.sessions, priority);
        return `### Què milloraria primer\n\n**1. ${LABELS[priority]}**\n\nÉs la prioritat segons les dades registrades.${roadmap !== null ? `\n\nProjecció orientativa: **${roadmap} setmanes**.` : ''}`;
    }
    if (lower.includes('què faig avui') || lower.includes('que faig avui')) {
        const plan = buildTodayPlan(priority || 'forestal', minutes, data);
        return `### Entrenament d'avui — ${plan.focusName}\n\n**Temps:** ${plan.minutes} min\n**Material:** ${plan.material}\n\n${plan.steps.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\nQuan acabis, registra temps i penalitzacions.`;
    }
    return '### Bomber Coach\n\nT’he llegit. Explica’m què vols millorar i t’analitzo les dades de l’entrenament.';
}

export default function AiPage() {
    const { messages, isStreaming, isLoadingHistory, sendMessage } = useIntegratedAi();
    const [params] = useSearchParams();
    const minutes = params.get('minuts');
    const [input, setInput] = useState('');
    const [localAnswer, setLocalAnswer] = useState('');
    const [data, setData] = useState({ sessions: [], weights: [], goals: [], material: [] });
    const [savedPlan, setSavedPlan] = useState(null);
    const [weeklyPlan, setWeeklyPlan] = useState(null);
    const endRef = useRef(null);

    useEffect(() => {
        const owner = pb.authStore.record?.id;
        if (!owner) return;
        const ownerFilter = `owner = "${owner}"`;
        Promise.all([
            pb.collection('bt_sessions').getFullList({ sort: '-date', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_weights').getFullList({ sort: '-date', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_goals').getFullList({ sort: '-created', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_settings').getFullList({ sort: '-created', filter: ownerFilter }).catch(() => []),
        ]).then(([sessions, weights, goals, settings]) => setData({ sessions, weights, goals, material: settings[0]?.material || [] }));
    }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, localAnswer]);

    const diagnosis = safeDiagnosis(data.sessions);
    const readiness = globalReadiness(data.sessions);
    const forestTargets = calculateForestTargets(data.sessions);

    const ask = async (text) => {
        const question = String(text || '').trim();
        if (!question || isStreaming) return;

        // FIRST: always produce a local result. This means the buttons work even if the AI endpoint is down.
        let local;
        try {
            local = localCoachAnswer(question, data, minutes);
        } catch (error) {
            local = `### Bomber Coach\n\nHi ha hagut un error analitzant les dades locals. Però el botó funciona.\n\n**Error:** ${error?.message || 'error desconegut'}`;
        }
        setLocalAnswer(local);
        setInput('');

        // SECOND: try the remote AI without blocking the local answer.
        try {
            const userContext = buildUserContext({ ...data, minutes });
            const bomberContext = buildBomberAiContext({ ...data, minutes });
            await sendMessage(`${question}\n\n[DADES BOMBER TRAINER]\n${userContext}\n\n${bomberContext}\n\n[ANÀLISI LOCAL]\n${local}\n\nAmplia l'anàlisi amb context útil i no contradiguis les dades.`);
        } catch (error) {
            // Local answer stays visible. Do not leave the user with a dead button.
            console.warn('Bomber Coach remote AI unavailable:', error);
        }
    };

    const saveToday = () => {
        const plan = buildTodayPlan(diagnosis.priority || 'forestal', minutes || 45, data);
        localStorage.setItem('bomber-trainer-today-plan', JSON.stringify({ ...plan, savedAt: new Date().toISOString() }));
        setSavedPlan(plan);
    };
    const adaptWeek = () => {
        const priority = diagnosis.priority || 'forestal';
        const other = ['forestal', 'estructural', 'aquatic'].filter((x) => x !== priority);
        const plan = { priority, generatedAt: new Date().toISOString(), days: [
            { day: 'Dilluns', title: `${LABELS[priority]} · treball específic`, detail: buildTodayPlan(priority, minutes || 45, data).steps.slice(0, 3).join(' · ') },
            { day: 'Dimarts', title: 'Recuperació activa', detail: 'Mobilitat + aeròbic suau.' },
            { day: 'Dimecres', title: `${LABELS[other[0]]} · tècnica`, detail: 'Tècnica + volum moderat.' },
            { day: 'Dijous', title: 'Descans / mobilitat', detail: 'Recuperació.' },
            { day: 'Divendres', title: `${LABELS[priority]} · control`, detail: 'Treball del punt feble.' },
            { day: 'Dissabte', title: `${LABELS[other[1]]} · capacitat`, detail: 'Sessió específica moderada.' },
            { day: 'Diumenge', title: 'Descans', detail: 'Preparar la setmana següent.' },
        ] };
        localStorage.setItem('bomber-trainer-week-plan', JSON.stringify(plan));
        setWeeklyPlan(plan);
    };
    const simulate = () => {
        const physical = (diagnosis.tests || []).map((t) => { const g = grade(t.type, t.latestTimeSeconds); return `• ${t.label}: ${formatTime(t.latestTimeSeconds)} → ${g === null ? 'pendent' : `${g.toFixed(1)}/10 orientatiu`}`; });
        const sim = `### Simulació d'oposició\n\n**Proves cronometrades**\n${physical.join('\n') || 'Encara no hi ha proves registrades.'}\n\n**Preparació global:** ${readiness.score === null ? 'pendent' : `${readiness.score.toFixed(1)}/10`}\n\nAquesta simulació és una fotografia de les marques registrades.`;
        setLocalAnswer(sim);
    };
    const roadmap = diagnosis.priority ? predictWeeks(data.sessions, diagnosis.priority) : null;

    return (
        <AppShell title="Assistent IA">
            <Helmet><title>Assistent IA — BOMBER TRAINER</title><meta name="description" content="Entrenador IA que analitza l'historial real i adapta la preparació de Bombers." /></Helmet>
            <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
                <p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH · ANÀLISI REAL</p>
                <p className="mt-1 text-sm font-medium text-slate-700">Analitzo les teves {data.sessions.length} sessions, pes, objectius, material i disponibilitat.</p>
                <p className="mt-2 text-xs font-semibold text-purple-700">{diagnosis.priority ? `Prioritat: ${LABELS[diagnosis.priority]}.` : 'Encara estic recollint dades per prioritzar.'} {readiness.score !== null ? `Preparació orientativa: ${readiness.score.toFixed(1)}/10.` : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                {QUICK.map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold">{q}</button>)}
                <button type="button" onClick={saveToday} className="min-h-[44px] rounded-xl bg-purple-700 px-3 text-sm font-bold text-white">💾 Guardar entrenament d'avui</button>
                <button type="button" onClick={adaptWeek} className="min-h-[44px] rounded-xl bg-white border border-purple-300 px-3 text-sm font-bold text-purple-700">📅 Adaptar setmana</button>
                <button type="button" onClick={simulate} className="col-span-2 min-h-[44px] rounded-xl bg-slate-900 px-3 text-sm font-bold text-white">🚒 Simulació oposició completa</button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest text-slate-500">FORESTAL · OBJECTIUS ORIENTATIUS PER A 10</p>
                <p className="mt-1 text-sm text-slate-600">Ruta completa: <b>3:10</b>. Repartiment proporcional a la càrrega dels trams; <b>no és barem oficial</b>.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{forestTargets.rows.map((r) => <div key={r.tram} className="rounded-xl bg-slate-50 p-3"><b>Tram {r.tram}</b><div className="text-lg">{formatTime(r.target)}</div><span className="text-xs text-slate-500">{r.actual ? `Tu: ${formatTime(r.actual)} · ${r.delta <= 0 ? '🟢' : '🟠'} ${r.delta > 0 ? '+' : ''}${Math.round(r.delta)} s` : 'pendent'}</span></div>)}</div>
            </div>
            {roadmap !== null && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold tracking-widest text-amber-700">PREDICCIÓ</p><p className="mt-1 text-sm">Amb la tendència recent de <b>{LABELS[diagnosis.priority]}</b>, l'arribada a la referència de 10 és estimada en <b>{roadmap} setmanes</b>.</p></div>}
            {savedPlan && <div className="rounded-3xl border border-green-200 bg-green-50 p-5"><p className="text-xs font-bold tracking-widest text-green-700">ENTRENAMENT D'AVUI GUARDAT</p><p className="mt-1 text-sm">{savedPlan.focusName} · {savedPlan.minutes} min · objectiu adaptat a les teves dades.</p></div>}
            {weeklyPlan && <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5"><p className="text-xs font-bold tracking-widest text-blue-700">SETMANA ADAPTADA</p><div className="mt-2 space-y-2">{weeklyPlan.days.map((d) => <div key={d.day} className="rounded-xl bg-white p-3"><b>{d.day} · {d.title}</b><p className="text-xs text-slate-600">{d.detail}</p></div>)}</div></div>}
            {localAnswer && <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm"><p className="mb-2 text-xs font-bold tracking-widest text-purple-700">BOMBER COACH · RESULTAT</p><div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{localAnswer}</div></div>}
            <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[240px]">
                {isLoadingHistory && <p className="text-sm text-slate-400">Carregant converses…</p>}
                {!isLoadingHistory && messages.length === 0 && <p className="text-sm text-slate-400">Pregunta'm el que vulguis sobre el teu entrenament.</p>}
                {messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.role === 'user' ? m.content.split('\n\n[DADES')[0] : m.content}</div></div>)}
                <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escriu la teva pregunta…" className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" />
                <button type="submit" disabled={isStreaming} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white disabled:opacity-60">{isStreaming ? '…' : 'Envia'}</button>
            </form>
        </AppShell>
    );
}
