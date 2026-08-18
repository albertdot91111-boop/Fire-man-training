import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useIntegratedAi } from '@/hooks/use-integrated-ai';
import { buildUserContext } from '@/lib/btData';
import { buildBomberAiContext, diagnoseBomberProgress } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];

export default function AiPage() {
    const { messages, isStreaming, isLoadingHistory, sendMessage } = useIntegratedAi();
    const [params] = useSearchParams();
    const minutes = params.get('minuts');
    const [input, setInput] = useState('');
    const [data, setData] = useState({ sessions: [], weights: [], goals: [], material: [] });
    const endRef = useRef(null);

    useEffect(() => {
        Promise.all([
            pb.collection('bt_sessions').getFullList({ sort: '-date' }).catch(() => []),
            pb.collection('bt_weights').getFullList({ sort: '-date' }).catch(() => []),
            pb.collection('bt_goals').getFullList().catch(() => []),
            pb.collection('bt_settings').getFullList().catch(() => []),
        ]).then(([sessions, weights, goals, settings]) => {
            setData({ sessions, weights, goals, material: settings[0]?.material || [] });
        });
    }, []);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const diagnosis = diagnoseBomberProgress(data.sessions);

    const ask = (text) => {
        if (!text.trim() || isStreaming) return;
        const userContext = buildUserContext({ ...data, minutes });
        const bomberContext = buildBomberAiContext({ ...data, minutes });
        sendMessage(`${text}\n\n${userContext}\n\n${bomberContext}`);
        setInput('');
    };

    return (
        <AppShell title="Assistent IA">
            <Helmet>
                <title>Assistent IA — BOMBER TRAINER</title>
                <meta name="description" content="Assistent IA que analitza el teu historial real i et recomana l'entrenament d'avui." />
            </Helmet>

            <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
                <p className="text-xs font-bold tracking-widest text-purple-700">ASSISTENT IA</p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                    Analitzo les teves {data.sessions.length} sessions registrades, el teu pes, objectius i material disponible
                    {minutes ? ` i els ${minutes} minuts que tens avui.` : '.'}
                </p>
                <p className="mt-2 text-xs font-semibold text-purple-700">
                    {diagnosis.priority ? `Prioritat actual: ${diagnosis.priority === 'aquatic' ? 'aquàtica' : diagnosis.priority === 'estructural' ? 'urbana / estructural' : 'forestal'}.` : 'Encara estic recollint dades per prioritzar.'}
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => ask(q)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-white border border-slate-200 px-4 text-sm font-semibold">{q}</button>
                ))}
                {minutes && (
                    <button type="button" onClick={() => ask(`Crea'm una sessió de ${minutes} minuts amb el material que tinc.`)} disabled={isStreaming} className="min-h-[44px] rounded-xl bg-purple-700 px-4 text-sm font-bold text-white">Sessió de {minutes} min</button>
                )}
            </div>

            <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[240px]">
                {isLoadingHistory && <p className="text-sm text-slate-400">Carregant converses…</p>}
                {!isLoadingHistory && messages.length === 0 && <p className="text-sm text-slate-400">Pregunta'm el que vulguis sobre el teu entrenament.</p>}
                {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                        <div className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>
                            {m.role === 'user' ? m.content.split('\n\n[DADES')[0] : m.content}
                        </div>
                    </div>
                ))}
                <div ref={endRef} />
            </div>

            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm">
                <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escriu la teva pregunta…" className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" />
                <button type="submit" disabled={isStreaming} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white disabled:opacity-60">{isStreaming ? '…' : 'Envia'}</button>
            </form>
        </AppShell>
    );
}
