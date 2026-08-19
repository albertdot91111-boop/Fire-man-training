import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useIntegratedAi } from '@/hooks/use-integrated-ai';
import { buildUserContext } from '@/lib/btData';
import { buildBomberAiContext, diagnoseBomberProgress, adjustedTime } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica' };
const BAREM10 = { forestal: 190, estructural: 130, aquatic: 190 }; // orientatius, no oficials

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
    return sessions.filter((s) => s.type === type).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

// Forestal: 10 = 3:10 total. Els 3 trams tenen càrrega 16/20/24 slam balls,
// per tant repartim el temps objectiu proporcionalment a la feina. És un objectiu
// d'entrenament inferit, NO un barem oficial de cada tram.
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
    const rows = target.map((seconds, i) => ({
        tram: i + 1,
        target: seconds,
        actual: actual[i],
        delta: actual[i] ? actual[i] - seconds : null,
        status: actual[i] ? (actual[i] <= seconds ? 'green' : 'orange') : 'pending',
    }));
    return { totalTarget: 190, rows, latestDate: latest?.date || null };
}
function globalReadiness(sessions) {
    const diagnosis = diagnoseBomberProgress(sessions);
    const scored = diagnosis.tests.map((t) => ({ ...t, grade: grade(t.type, t.latestTimeSeconds) })).filter((t) => t.grade !== null);
    if (!scored.length) return { score: null, scored, missing: diagnosis.tests.filter((t) => !t.sessions).map((t) => t.label) };
    const score = scored.reduce((sum, x) => sum + x.grade, 0) / scored.length;
    return { score, scored, missing: diagnosis.tests.filter((t) => !t.sessions).map((t) => t.label) };
}
function predictWeeks(sessions, type) {
    const rows = typeSessions(sessions, type).slice(-6).map(adjustedTime).filter((x) => x > 0);
    if (rows.length < 3) return null;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const improvement = (first - last) / Math.max(1, rows.length - 1);
    const target = BAREM10[type];
    if (improvement <= 0 || last <= target) return last <= target ? 0 : null;
    const weeks = Math.ceil((last - target) / improvement / 1.5);
    return clamp(weeks, 1, 52);
}
function buildTodayPlan(focus, minutes, data) {
    const mins = Number(minutes) > 0 ? Number(minutes) : 45;
    const targetInfo = focus === 'forestal' ? calculateForestTargets(data.sessions) : null;
    const focusName = LABELS[focus];
    const short = mins <= 30;
    let steps;
    if (focus === 'forestal') {
        const t = targetInfo.rows;
        steps = short
            ? ['Escalfament 6 min', `2 × Tram 1: objectiu ≤ ${formatTime(t[0].target)}`, `2 × Tram 2: objectiu ≤ ${formatTime(t[1].target)}`, '5 min recuperació']
            : ['Escalfament 8 min', `3 × Tram 2 específic: objectiu ≤ ${formatTime(t[1].target)} per repetició`, `2 × Tram 3 controlat: objectiu ≤ ${formatTime(t[2].target)}`, '1 × circuit complet al 80–90%', '8 min recuperació'];
    } else if (focus === 'estructural') {
        steps = short ? ['Escalfament 6 min', '3 × bloc tècnic amb descans complet', '2 × arrossegament/empenyiment controlat', '5 min recuperació'] : ['Escalfament 10 min', '3 × circuit tècnic', '3 × arrossegament/empenyiment', '1 × circuit complet controlat', '10 min recuperació'];
    } else {
        steps = short ? ['Escalfament 8 min', '4 × 25 m tècnics', '2 × remolc controlat', '5 min recuperació'] : ['Escalfament 10 min', '4 × 25 m tècnics', '3 × treball de remolc', '1 × prova contínua controlada', '10 min recuperació'];
    }
    return { focus, focusName, minutes: mins, material: data.material?.length ? data.material.join(', ') : 'sense material registrat', steps, targetInfo };
}
function buildWeeklyPlan(priority, sessions, minutes, data) {
    const recent = typeSessions(sessions, priority).slice(-2).length;
    const other = ['forestal', 'estructural', 'aquatic'].filter((x) => x !== priority);
    const focus = LABELS[priority] || 'Forestal';
    const days = [
        { day: 'Dilluns', type: priority, title: `${focus} · treball específic`, detail: buildTodayPlan(priority, minutes, data).steps.slice(0, 3).join(' · ') },
        { day: 'Dimarts', type: 'recovery', title: 'Recuperació activa', detail: 'Mobilitat + aeròbic suau. No test.' },
        { day: 'Dimecres', type: other[0], title: `${LABELS[other[0]]} · tècnica`, detail: 'Treball tècnic + volum moderat, sense màxims.' },
        { day: 'Dijous', type: 'recovery', title: 'Descans / mobilitat', detail: 'Recuperació segons fatiga i dolor.' },
        { day: 'Divendres', type: priority, title: `${focus} · control`, detail: 'Repetir el punt feble amb objectiu de qualitat i registrar temps.' },
        { day: 'Dissabte', type: other[1], title: `${LABELS[other[1]]} · capacitat`, detail: 'Sessió específica moderada; evitar dos tests màxims seguits.' },
        { day: 'Diumenge', type: 'recovery', title: 'Descans', detail: 'Preparar la setmana següent segons resultats.' },
    ];
    return { priority, generatedAt: new Date().toISOString(), recentPrioritySessions: recent, days };
}
function localCoachAnswer(question, data, minutes) {
    const diagnosis = diagnoseBomberProgress(data.sessions || []);
    const tests = diagnosis.tests.filter((t) => t.sessions > 0);
    const priority = diagnosis.priority;
    const availableMinutes = Number(minutes) > 0 ? Number(minutes) : 45;
    const lower = question.toLowerCase();
    if (lower.includes('com vaig')) {
        if (!tests.length) return 'Encara no tinc prou sessions cronometrades per valorar el teu nivell. Registra almenys una sessió de cada prova.';
        const readiness = globalReadiness(data.sessions || []);
        const lines = tests.map((t) => { const g = grade(t.type, t.latestTimeSeconds); const trend = t.trendSeconds == null ? '' : t.trendSeconds < 0 ? ` 🟢 ${Math.abs(Math.round(t.trendSeconds))} s més ràpid` : t.trendSeconds > 0 ? ` 🔴 ${Math.round(t.trendSeconds)} s més lent` : ' 🟡 estable'; return `• ${t.label}: últim ${formatTime(t.latestTimeSeconds)}, millor ${formatTime(t.bestTimeSeconds)}${g !== null ? ` · nota orientativa ${g.toFixed(1)}` : ''}${trend}`; });
        return `### Com vas ara\n\n${lines.join('\n')}\n\n**Preparació global orientativa:** ${readiness.score === null ? 'pendent' : `${readiness.score.toFixed(1)}/10`}\n\n**Prioritat:** ${priority ? LABELS[priority] : 'pendent de dades'}.\n\nLes notes són orientatives i els barems incorporats no són oficials.`;
    }
    if (lower.includes('punts febles')) {
        if (!tests.length) return 'Encara no puc detectar punts febles: necessito més sessions registrades.';
        const ranked = [...tests].sort((a, b) => (b.trendSeconds || 0) - (a.trendSeconds || 0));
        return `### Els teus punts febles\n\n${ranked.map((t, i) => `${i + 1}. **${t.label}** — ${t.trendSeconds > 0 ? `tendència negativa: +${Math.round(t.trendSeconds)} s` : t.trendSeconds < 0 ? `millora: ${Math.abs(Math.round(t.trendSeconds))} s` : 'estable'}`).join('\n')}\n\n**Prioritat:** ${priority ? LABELS[priority] : 'encara no determinada'}.`;
    }
    if (lower.includes('millorar')) {
        if (!priority) return 'Primer registra més proves. Amb dades suficients et diré quina prova està limitant més el progrés.';
        const roadmap = predictWeeks(data.sessions || [], priority);
        return `### Què milloraria primer\n\n**1. ${LABELS[priority]}**\n\nÉs la prioritat actual segons les teves dades.${roadmap ? ` Amb la tendència actual, la referència de 10 podria quedar a aproximadament **${roadmap} setmanes**.` : ''}\n\nNo augmentis volum i intensitat alhora. Si hi ha dolor, para i consulta un professional.`;
    }
    if (lower.includes('què faig avui') || lower.includes('que faig avui')) {
        const focus = priority || 'forestal';
        const plan = buildTodayPlan(focus, availableMinutes, data);
        return `### Entrenament d'avui — ${plan.focusName}\n\n**Temps:** ${plan.minutes} min\n**Material:** ${plan.material}\n\n${plan.steps.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n${plan.targetInfo ? `**Objectiu ruta completa:** ${formatTime(plan.targetInfo.totalTarget)} per equivalència orientativa de 10. Cada tram té un objectiu proporcional a la seva càrrega: ${plan.targetInfo.rows.map((r) => `T${r.tram} ${formatTime(r.target)}`).join(' · ')}.` : ''}\n\nQuan acabis, registra temps i penalitzacions i el següent pla s'adaptarà.`;
    }
    return null;
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
        if (!owner) { setData({ sessions: [], weights: [], goals: [], material: [] }); return; }
        const ownerFilter = `owner = "${owner}"`;
        Promise.all([
            pb.collection('bt_sessions').getFullList({ sort: '-date', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_weights').getFullList({ sort: '-date', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_goals').getFullList({ sort: '-created', filter: ownerFilter }).catch(() => []),
            pb.collection('bt_settings').getFullList({ sort: '-created', filter: ownerFilter }).catch(() => []),
        ]).then(([sessions, weights, goals, settings]) => setData({ sessions, weights, goals, material: settings[0]?.material || [] }));
    }, []);
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, localAnswer]);
    const diagnosis = diagnoseBomberProgress(data.sessions);
    const readiness = globalReadiness(data.sessions);
    const forestTargets = calculateForestTargets(data.sessions);

    const ask = (text) => {
        if (!text.trim() || isStreaming) return;
        const local = localCoachAnswer(text, data, minutes);
        setLocalAnswer(local || '');
        const userContext = buildUserContext({ ...data, minutes });
        const bomberContext = buildBomberAiContext({ ...data, minutes });
        sendMessage(`${text}\n\n[DADES BOMBER TRAINER]\n${userContext}\n\n${bomberContext}${local ? `\n\n[ANÀLISI LOCAL DE L'ENTRENADOR]\n${local}\n\nAmplia aquesta anàlisi amb context útil i no contradiguis les dades.` : ''}`);
        setInput('');
    };
    const saveToday = () => {
        const plan = buildTodayPlan(diagnosis.priority || 'forestal', minutes || 45, data);
        localStorage.setItem('bomber-trainer-today-plan', JSON.stringify({ ...plan, savedAt: new Date().toISOString() }));
        setSavedPlan(plan);
    };
    const adaptWeek = () => {
        const plan = buildWeeklyPlan(diagnosis.priority || 'forestal', data.sessions, minutes || 45, data);
        localStorage.setItem('bomber-trainer-week-plan', JSON.stringify(plan));
        setWeeklyPlan(plan);
    };
    const simulate = () => {
        const physical = diagnosis.tests.map((t) => { const g = grade(t.type, t.latestTimeSeconds); return `• ${t.label}: ${formatTime(t.latestTimeSeconds)} → ${g === null ? 'pendent' : `${g.toFixed(1)}/10 orientatiu`}`; });
        const strength = ['pit', 'cames', 'pressbanca'].map((type) => { const n = typeSessions(data.sessions, type).length; return `• ${type}: ${n ? `${n} sessió/ns registrades · sense barem oficial` : 'pendent'}`; });
        const sim = `### Simulació d'oposició\n\n**Proves cronometrades**\n${physical.join('\n') || 'Encara no hi ha proves registrades.'}\n\n**Força**\n${strength.join('\n')}\n\n**Preparació global:** ${readiness.score === null ? 'pendent' : `${readiness.score.toFixed(1)}/10`}\n\nAquesta simulació és una fotografia de les marques registrades. No substitueix la puntuació oficial de la convocatòria.`;
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
                <button type="button" onClick={saveToday} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-purple-700 px-3 text-sm font-bold text-white">💾 Guardar entrenament d'avui</button>
                <button type="button" onClick={adaptWeek} className="min-h-[44px] rounded-xl bg-white border border-purple-300 px-3 text-sm font-bold text-purple-700">📅 Adaptar setmana</button>
                <button type="button" onClick={simulate} className="col-span-2 min-h-[44px] rounded-xl bg-slate-900 px-3 text-sm font-bold text-white">🚒 Simulació oposició completa</button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest text-slate-500">FORESTAL · OBJECTIUS ORIENTATIUS PER A 10</p>
                <p className="mt-1 text-sm text-slate-600">Ruta completa: <b>3:10</b>. Repartiment proporcional a la càrrega dels trams; <b>no és barem oficial</b>.</p>
                <div className="mt-3 grid grid-cols-3 gap-2">{forestTargets.rows.map((r) => <div key={r.tram} className="rounded-xl bg-slate-50 p-3"><b>Tram {r.tram}</b><div className="text-lg">{formatTime(r.target)}</div><span className="text-xs text-slate-500">{r.actual ? `Tu: ${formatTime(r.actual)} · ${r.delta <= 0 ? '🟢' : '🟠'} ${r.delta > 0 ? '+' : ''}${Math.round(r.delta)} s` : 'pendent'}</span></div>)}</div>
            </div>
            {roadmap !== null && <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold tracking-widest text-amber-700">PREDICCIÓ</p><p className="mt-1 text-sm">Amb la tendència recent de <b>{LABELS[diagnosis.priority]}</b>, l'arribada a la referència de 10 és estimada en <b>{roadmap} setmanes</b>. És una projecció, no una garantia.</p></div>}
            {savedPlan && <div className="rounded-3xl border border-green-200 bg-green-50 p-5"><p className="text-xs font-bold tracking-widest text-green-700">ENTRENAMENT D'AVUI GUARDAT</p><p className="mt-1 text-sm">{savedPlan.focusName} · {savedPlan.minutes} min · objectiu adaptat a les teves dades.</p></div>}
            {weeklyPlan && <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5"><p className="text-xs font-bold tracking-widest text-blue-700">SETMANA ADAPTADA</p><div className="mt-2 space-y-2">{weeklyPlan.days.map((d) => <div key={d.day} className="rounded-xl bg-white p-3"><b>{d.day} · {d.title}</b><p className="text-xs text-slate-600">{d.detail}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Guardada localment al dispositiu. Es recalcula després de noves sessions.</p></div>}
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
