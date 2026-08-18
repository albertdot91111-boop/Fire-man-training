import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useIntegratedAi } from '@/hooks/use-integrated-ai';
import { buildUserContext } from '@/lib/btData';
import { buildBomberAiContext, diagnoseBomberProgress } from '@/aiEngine';
import { coachBrief, buildLearningLoop } from '@/bomberCoach';
import { buildAdaptiveRecommendations } from '@/adaptiveCoach';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];

export default function AiPage() {
    const { messages, isStreaming, isLoadingHistory, sendMessage } = useIntegratedAi();
    const [params] = useSearchParams();
    const minutes = params.get('minuts');
    const [input, setInput] = useState('');
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

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const diagnosis = diagnoseBomberProgress(data.sessions);
    const brief = coachBrief({ ...data, minutes: minutes || 45 });
    const adaptive = buildAdaptiveRecommendations({ ...data, minutes: minutes || 45 });
    const learning = buildLearningLoop(data.sessions);

    const ask = (text) => {
        if (!text.trim() || isStreaming) return;
        const userContext = buildUserContext({ ...data, minutes });
        const bomberContext = buildBomberAiContext({ ...data, minutes });
        const learningContext = [
            '[MEMÒRIA DE RESULTATS DEL BOMBER COACH]',
            ...(learning.tests.length ? learning.tests.map((x) => `${x.label}: ${x.decision}; canvi de nota ${x.delta >= 0 ? '+' : ''}${x.delta.toFixed(1)}; ${x.reason}`) : ['Encara no hi ha dues sessions comparables de la mateixa prova.']),
            '[FI MEMÒRIA]',
        ].join('\n');
        const adaptiveContext = ['[BOMBER COACH — PROGRESSIÓ ADAPTATIVA]', adaptive.principle, ...adaptive.recommendations.map((r) => `${r.title}: ${r.detail}`), '[FI PROGRESSIÓ ADAPTATIVA]'].join('\n');
        const coachContext = ['[BOMBER COACH — MOTOR DE DECISIÓ LOCAL]', brief.text, `Sessió proposada: ${brief.plan.blocks.join(' | ')}`, `Material: ${brief.plan.materialUsed.join(', ')}`, 'Els barems indicats com inferits NO són oficials.', '[FI BOMBER COACH]'].join('\n');
        sendMessage(`${text}\n\n${userContext}\n\n${bomberContext}\n\n${learningContext}\n\n${adaptiveContext}\n\n${coachContext}`);
        setInput('');
    };

    return (
        <AppShell title="Assistent IA">
            <Helmet><title>Assistent IA — BOMBER TRAINER</title><meta name="description" content="Assistent IA que analitza l'historial real i adapta l'entrenament de Bombers." /></Helmet>

            <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
                <p className="text-xs font-bold tracking-widest text-purple-700">ASSISTENT IA + BOMBER COACH</p>
                <p className="mt-1 text-sm font-medium text-slate-700">Analitzo historial, objectius, material, càrrega i temps disponible per decidir què convé fer.</p>
                <p className="mt-2 text-xs font-semibold text-purple-700">{diagnosis.priority ? `Prioritat actual: ${diagnosis.priority === 'aquatic' ? 'aquàtica' : diagnosis.priority === 'estructural' ? 'urbana / estructural' : 'forestal'}.` : 'Encara estic recollint dades per prioritzar.'}</p>
            </div>

            <section className="rounded-3xl border border-purple-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-purple-600">DECISIÓ AUTOMÀTICA</p><h2 className="mt-1 text-lg font-extrabold">{brief.plan.focus.title}</h2><p className="mt-1 text-sm text-slate-600">{brief.plan.focus.reason}</p></div><span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700">{brief.plan.readiness}</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">{brief.analysis.tests.filter((t) => t.latestGrade !== null).map((t) => <div key={t.type} className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">{t.label.toUpperCase()}</p><p className="mt-1 text-lg font-extrabold">{Math.round(t.latestGrade * 10) / 10}/10</p><p className="text-xs text-slate-500">millor {Math.round((t.bestGrade ?? 0) * 10) / 10}/10{t.inferred ? ' · barem inferit' : ''}</p></div>)}</div>
                {brief.plan.warnings.length > 0 && <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{brief.plan.warnings.join(' ')}</div>}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest text-slate-500">MEMÒRIA D'APRENENTATGE</p>
                {learning.actionable ? <div className="mt-3 rounded-2xl bg-slate-50 p-3"><p className="text-sm font-bold">{learning.actionable.label}: {learning.actionable.decision}</p><p className="mt-1 text-xs text-slate-600">Nota {Math.round(learning.actionable.previousGrade * 10) / 10} → {Math.round(learning.actionable.latestGrade * 10) / 10} ({learning.actionable.delta >= 0 ? '+' : ''}{Math.round(learning.actionable.delta * 10) / 10})</p><p className="mt-1 text-xs text-slate-600">{learning.actionable.reason}</p></div> : <p className="mt-3 text-sm text-slate-500">Necessito almenys dues sessions comparables d'una prova per aprendre del resultat.</p>}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold tracking-widest text-slate-500">PROGRESSIÓ ADAPTATIVA</p>
                <div className="mt-3 space-y-2">{adaptive.recommendations.map((r, i) => <div key={`${r.type}-${i}`} className="rounded-2xl bg-slate-50 p-3"><p className="text-sm font-bold">{r.title}</p><p className="mt-1 text-xs text-slate-600">{r.detail}</p></div>)}</div>
                <p className="mt-3 text-xs font-semibold text-slate-500">{adaptive.principle}</p>
            </section>

            <button type="button" onClick={() => ask(`Executa la sessió proposada pel Bomber Coach i adapta-la a ${minutes || 45} minuts.`)} disabled={isStreaming} className="min-h-[46px] rounded-xl bg-purple-700 px-4 text-sm font-bold text-white disabled:opacity-60">Fer aquesta sessió amb la IA</button>
            <div className="flex flex-wrap gap-2">{QUICK.map((q) => <button key={q} type="button" onClick={() => ask(q)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-white border border-slate-200 px-4 text-sm font-semibold">{q}</button>)}{minutes && <button type="button" onClick={() => ask(`Crea'm una sessió de ${minutes} minuts amb el material que tinc.`)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-purple-700 px-4 text-sm font-bold text-white">Sessió de {minutes} min</button>}</div>

            <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[240px]">{isLoadingHistory && <p className="text-sm text-slate-400">Carregant converses…</p>}{!isLoadingHistory && messages.length === 0 && <p className="text-sm text-slate-400">Pregunta'm el que vulguis sobre el teu entrenament.</p>}{messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.role === 'user' ? m.content.split('\n\n[DADES')[0] : m.content}</div></div>)}<div ref={endRef} /></div>
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm"><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escriu la teva pregunta…" className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" /><button type="submit" disabled={isStreaming} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white disabled:opacity-60">{isStreaming ? '…' : 'Envia'}</button></form>
        </AppShell>
    );
}
