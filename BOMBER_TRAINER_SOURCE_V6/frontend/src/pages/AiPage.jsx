import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useIntegratedAi } from '@/hooks/use-integrated-ai';
import { buildUserContext } from '@/lib/btData';
import { buildBomberAiContext, diagnoseBomberProgress } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica' };

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}
function typeSessions(sessions, type) {
    return sessions.filter((s) => s.type === type).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function localCoachAnswer(question, data, minutes) {
    const diagnosis = diagnoseBomberProgress(data.sessions || []);
    const tests = diagnosis.tests.filter((t) => t.sessions > 0);
    const priority = diagnosis.priority;
    const weight = data.weights?.[0]?.weight;
    const goal = data.goals?.[0];
    const material = data.material?.length ? data.material.join(', ') : 'material no indicat';
    const availableMinutes = Number(minutes) > 0 ? Number(minutes) : 45;
    const lower = question.toLowerCase();

    if (lower.includes('com vaig')) {
        if (!tests.length) return 'Encara no tinc prou sessions cronometrades per valorar el teu nivell. Registra almenys una sessió de cada prova i et faré la comparació.';
        const lines = tests.map((t) => {
            const trend = t.trendSeconds == null ? '' : t.trendSeconds < 0 ? ` 🟢 ${Math.abs(Math.round(t.trendSeconds))} s més ràpid` : t.trendSeconds > 0 ? ` 🔴 ${Math.round(t.trendSeconds)} s més lent` : ' 🟡 estable';
            return `• ${t.label}: últim ${formatTime(t.latestTimeSeconds)}, millor ${formatTime(t.bestTimeSeconds)}${trend}`;
        });
        return `### Com vas ara\n\n${lines.join('\n')}\n\n**Prioritat actual:** ${priority ? LABELS[priority] : 'pendent de més dades'}.\n\nAquesta lectura surt de les teves sessions reals, no d'una nota inventada.${weight ? ` Pes recent: ${weight} kg.` : ''}${goal?.title ? ` Objectiu actiu: ${goal.title}.` : ''}`;
    }
    if (lower.includes('punts febles')) {
        if (!tests.length) return 'Encara no puc detectar punts febles: necessito més sessions registrades.';
        const ranked = [...tests].sort((a, b) => b.penaltiesLatest !== a.penaltiesLatest ? b.penaltiesLatest - a.penaltiesLatest : (b.trendSeconds || 0) - (a.trendSeconds || 0));
        return `### Els teus punts febles\n\n${ranked.map((t, i) => `${i + 1}. **${t.label}** — ${t.penaltiesLatest ? `${t.penaltiesLatest} penalització/ons recents` : t.trendSeconds > 0 ? `tendència negativa: +${Math.round(t.trendSeconds)} s` : 'sense senyal negatiu clar'}`).join('\n')}\n\n**Prioritat:** ${priority ? LABELS[priority] : 'encara no determinada'}.`;
    }
    if (lower.includes('millorar')) {
        if (!priority) return 'Primer registra més proves. Amb dades suficients et diré quina prova està limitant més el teu progrés.';
        return `### Què milloraria primer\n\n**1. ${LABELS[priority]}** — és la prioritat actual segons les teves dades.\n\nTens ${typeSessions(data.sessions || [], priority).length} sessió/ns registrada/es d'aquesta prova.\n\n**Objectiu de la propera sessió:** treballar qualitat i repetir la prova sense buscar màxima intensitat a cada intent.\n\nSi hi ha dolor, para i no intentis compensar augmentant càrrega o volum.`;
    }
    if (lower.includes('què faig avui') || lower.includes('que faig avui')) {
        const focus = priority || 'forestal';
        const focusName = LABELS[focus];
        const short = availableMinutes <= 30;
        const long = availableMinutes >= 60;
        const plan = focus === 'forestal'
            ? (short ? ['Escalfament 6 min', '3 × tram tècnic a ritme controlat', '2 × ruta parcial', '5 min recuperació'] : long ? ['Escalfament 10 min', '4 × treball específic de tram', '2 × circuit complet al 80–90%', '10 min recuperació'] : ['Escalfament 8 min', '3 × treball específic de tram', '1 × circuit complet controlat', '8 min recuperació'])
            : focus === 'estructural'
                ? (short ? ['Escalfament 6 min', '3 × bloc tècnic', '2 × arrossegament/empenta', '5 min recuperació'] : ['Escalfament 10 min', '3 × circuit tècnic', '3 × arrossegament/empenyiment', '10 min recuperació'])
                : (short ? ['Escalfament 8 min', '4 × 25 m tècnics', '2 × remolc controlat', '5 min recuperació'] : ['Escalfament 10 min', '4 × 25 m tècnics', '3 × treball de remolc', '10 min recuperació']);
        return `### Entrenament d'avui — ${focusName}\n\n**Temps disponible:** ${availableMinutes} min\n**Material:** ${material}\n\n${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n**Intenció:** millorar ${focusName.toLowerCase()} sense convertir cada sessió en un test màxim.\n\nQuan acabis, registra els temps i penalitzacions i la següent recomanació s'ajustarà a les dades noves.`;
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

    const ask = (text) => {
        if (!text.trim() || isStreaming) return;
        const local = localCoachAnswer(text, data, minutes);
        setLocalAnswer(local || '');
        const userContext = buildUserContext({ ...data, minutes });
        const bomberContext = buildBomberAiContext({ ...data, minutes });
        sendMessage(`${text}\n\n[DADES BOMBER TRAINER]\n${userContext}\n\n${bomberContext}${local ? `\n\n[ANÀLISI LOCAL DE L'ENTRENADOR]\n${local}\n\nAmplia aquesta anàlisi amb context útil i no contradiguis les dades.` : ''}`);
        setInput('');
    };

    return (
        <AppShell title="Assistent IA">
            <Helmet><title>Assistent IA — BOMBER TRAINER</title><meta name="description" content="Assistent IA que analitza l'historial real i ajuda a decidir què entrenar." /></Helmet>
            <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
                <p className="text-xs font-bold tracking-widest text-purple-700">ASSISTENT IA</p>
                <p className="mt-1 text-sm font-medium text-slate-700">Analitzo les teves {data.sessions.length} sessions registrades, el teu pes, objectius i material disponible{minutes ? ` i els ${minutes} minuts que tens avui.` : '.'}</p>
                <p className="mt-2 text-xs font-semibold text-purple-700">{diagnosis.priority ? `Prioritat actual: ${diagnosis.priority === 'aquatic' ? 'aquàtica' : diagnosis.priority === 'estructural' ? 'urbana / estructural' : 'forestal'}.` : 'Encara estic recollint dades per prioritzar.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-white border border-slate-200 px-4 text-sm font-semibold">{q}</button>)}
                {minutes && <button type="button" onClick={() => ask(`Crea'm una sessió de ${minutes} minuts amb el material que tinc.`)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-purple-700 px-4 text-sm font-bold text-white">Sessió de {minutes} min</button>}
            </div>
            {localAnswer && <div className="rounded-3xl border border-purple-200 bg-purple-50 p-5 shadow-sm"><p className="mb-2 text-xs font-bold tracking-widest text-purple-700">BOMBER COACH · ANÀLISI IMMEDIATA</p><div className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{localAnswer}</div><p className="mt-3 text-xs text-slate-500">Aquesta part es calcula directament amb les teves dades. La IA externa pot ampliar-la a continuació.</p></div>}
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
