import React, { useEffect, useMemo, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { diagnoseBomberProgress } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?', 'Com evoluciono?', 'Quant fa que no treballo cada prova?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica', pit: 'Banca', cames: 'Cames', pressbanca: 'Press banca', manteniment: 'Entrenament normal' };
const CHAT_TTL_MS = 72 * 60 * 60 * 1000;
function chatStorageKey(owner) { return `bt_ai_chat_${owner || 'guest'}`; }
function pacePerKm(durationSeconds, distanceMeters) {
  const s = Number(durationSeconds), m = Number(distanceMeters);
  if (!Number.isFinite(s) || !Number.isFinite(m) || s <= 0 || m <= 0) return null;
  const sec = Math.round(s / (m / 1000));
  return Number.isFinite(sec) && sec > 0 && sec <= 3600 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km` : null;
}
function daysSince(date) { if (!date) return null; const t = Date.parse(date); return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : null; }
function normalizeQuestion(question) { return String(question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function latestSessions(sessions) { return sessions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))); }
function metricDistance(s) { return Number(s?.wearable?.distanceKm) || (Number(s?.wearable?.distanceMeters) > 0 ? Number(s.wearable.distanceMeters) / 1000 : null); }
function metricDuration(s) { return Number(s?.wearable?.durationSeconds) || (Number(s?.duration) > 0 ? Number(s.duration) * 60 : null); }
function localCoachAnswer(question, data) {
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const q = normalizeQuestion(question);
  const diagnosis = diagnoseBomberProgress(sessions);
  const sorted = latestSessions(sessions);
  const focus = diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'pendent de més dades';
  const recent = sorted.slice(0, 8);
  const has = (...terms) => terms.some(t => q.includes(t));
  if (has('hola', 'bon dia', 'bona tarda', 'bona nit', 'ei', 'hey')) return `### Hola!\n\nSoc el **Bomber Coach**. Tinc les teves dades disponibles i puc analitzar el teu entrenament.\n\nAra mateix la prioritat detectada és **${focus}**.\n\nPregunta'm, per exemple, si has millorat, què hauries d'entrenar avui, quina ha estat la teva millor sessió o com vas respecte als teus objectius.`;
  if (has('com vaig', 'com estic', 'estat actual', 'preparacio', 'preparació')) {
    const rows = diagnosis.tests.map(t => `• **${t.label}**: ${t.readiness?.progress ?? 0}%${t.latestTimeSeconds ? ` · últim registre ${Math.round(t.latestTimeSeconds)} s` : ' · sense registre'}`).join('\n');
    return `### Com vas?\n\n**Prioritat actual:** ${focus}.\n\n${rows || 'Encara no hi ha prou dades per valorar les proves.'}`;
  }
  if (has('millorar', 'punts febles', 'feble', 'prioritat')) return `### Què milloraria primer\n\n**${focus}**.\n\nLa prioritat es basa en les dades registrades i en els objectius disponibles. No considero una prova feble només perquè falti informació.`;
  if (has('que faig avui', 'què faig avui', 'entreno avui', 'entrenar avui', 'avui')) return `### Entrenament d'avui\n\n**Focus:** ${focus}.\n\n1. Escalfament 8–10 min.\n2. Treball específic de la prioritat.\n3. Registra temps, repeticions i penalitzacions.\n4. Recuperació i mobilitat.\n\nSi avui ja tens una sessió registrada, explica'm el resultat i adapto la següent.`;
  if (has('evolucion', 'evolució', 'millorat', 'milloro', 'millora', 'tendencia', 'tendència')) {
    if (!recent.length) return '### Evolució\n\nEncara no hi ha sessions registrades suficients per valorar una tendència.';
    return `### Evolució recent\n\n${recent.map(s => { const d = metricDistance(s); const dur = metricDuration(s); const pace = pacePerKm(s.wearable?.durationSeconds, s.wearable?.distanceMeters); const hr = s.wearable?.heartRate?.average; return `• **${s.date || 'Sense data'}** — ${LABELS[s.type] || s.type || 'Activitat'}${dur ? ` · ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}` : ''}${d ? ` · ${d.toFixed(2)} km` : ''}${pace ? ` · ${pace}` : ''}${hr ? ` · FC ${Math.round(hr)} bpm` : ''}`; }).join('\n')}\n\nLa tendència és més fiable comparant diverses sessions, no una sola marca.`;
  }
  if (has('millor activitat', 'millor sessio', 'millor sessió', 'record')) {
    const withScore = sorted.filter(s => Number.isFinite(Number(s.points)));
    if (!withScore.length) return '### Millor activitat\n\nEncara no tinc puntuacions suficients per determinar-la.';
    const best = withScore.slice().sort((a, b) => Number(b.points) - Number(a.points))[0];
    return `### Millor activitat\n\n**${LABELS[best.type] || best.type || 'Activitat'}** · ${best.points} punts · ${best.date || 'sense data'}.`;
  }
  if (has('quant fa', 'fa quant', 'ultim', 'últim', 'temps que no', 'dies que no')) {
    const types = ['estructural', 'forestal', 'aquatic', 'pressbanca', 'cames'];
    return `### Temps des de l'últim entrenament\n\n${types.map(type => { const row = sessions.filter(s => s.type === type).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0]; const days = daysSince(row?.date); return `• **${LABELS[type]}**: ${days === null ? 'mai registrat' : `fa ${days} dies`}`; }).join('\n')}`;
  }
  if (has('fc', 'freqüencia cardiaca', 'frequencia cardiaca', 'pulsacions', 'batecs')) {
    const rows = sorted.filter(s => Number(s.wearable?.heartRate?.average) > 0).slice(0, 5);
    if (!rows.length) return '### Freqüència cardíaca\n\nNo tinc dades de FC disponibles en les sessions recents.';
    return `### Freqüència cardíaca\n\n${rows.map(s => `• ${s.date || 'Sense data'} — FC mitjana **${Math.round(s.wearable.heartRate.average)} bpm**${s.wearable.heartRate.max ? ` · màxima ${Math.round(s.wearable.heartRate.max)} bpm` : ''}`).join('\n')}`;
  }
  if (has('correr', 'córrer', 'ritme', 'km', 'distancia', 'distància', 'corrent')) {
    const rows = sorted.filter(s => metricDistance(s) && metricDuration(s)).slice(0, 5);
    if (!rows.length) return '### Activitats de resistència\n\nNo tinc prou activitats sincronitzades amb distància i temps per calcular el ritme.';
    return `### Activitats recents\n\n${rows.map(s => { const d = metricDistance(s), dur = metricDuration(s), pace = pacePerKm(dur, d * 1000); return `• ${s.date || 'Sense data'} — **${d.toFixed(2)} km** · ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')} · **${pace || 'ritme no disponible'}**`; }).join('\n')}`;
  }
  return `### Anàlisi local\n\nHe revisat les dades disponibles de Bomber Trainer. La prioritat detectada és **${focus}**.\n\nPuc analitzar el teu progrés, punts febles, evolució, entrenaments recents, distància, ritme, FC i temps des de l'últim treball. Si em fas una pregunta concreta, buscaré primer la dada corresponent abans de respondre.`;
}
function makeContext(data) {
  const diagnosis = diagnoseBomberProgress(data.sessions || []);
  const sorted = latestSessions(data.sessions || []);
  const classified = sorted.filter(s => ['forestal', 'estructural', 'aquatic', 'pressbanca', 'cames'].includes(s.type));
  const selected = [...classified, ...sorted.filter(s => !classified.includes(s))].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i).slice(0, 150);
  return JSON.stringify({ diagnosis, sessions: selected.map(s => ({ id: s.id, type: s.type, classification: s.type, date: s.date, duration: s.duration, points: s.points, penalties: s.penalties, notes: s.notes, data: s.data, wearable: s.wearable ? { source: s.wearable.source, activityId: s.wearable.activityId, activityType: s.wearable.activityType, name: s.wearable.name, durationSeconds: s.wearable.durationSeconds, distanceKm: s.wearable.distanceKm, distanceMeters: s.wearable.distanceMeters, pacePerKm: pacePerKm(s.wearable.durationSeconds, s.wearable.distanceMeters), heartRate: s.wearable.heartRate, calories: s.wearable.calories, trainingLoad: s.wearable.trainingLoad, streamTypes: s.wearable.streamTypes } : undefined })), weights: data.weights || [], goals: data.goals || [], material: data.material || [], minutes: data.minutes || '' });
}

function shouldUseLocal(question) {
  const q = normalizeQuestion(question);
  const localPatterns = ['com vaig', 'com porto', 'com van els meus', 'que porto millor', 'punts febles', 'que haig de millorar', 'què haig de millorar', 'que faig avui', 'què faig avui', 'evolucio', 'evolució', 'quant fa', 'quan vaig', 'ultim entrenament', 'últim entrenament', 'quants dies', 'prioritat', 'quina prova tinc pitjor'];
  return localPatterns.some(pattern => q.includes(normalizeQuestion(pattern)));
}
function localFallback(question, data) {
  const answer = localCoachAnswer(question, data);
  return answer || 'La IA externa no està disponible ara mateix. El Coach local continua disponible per analitzar les teves dades.';
}

export default function AiPage() {
  const ownerId = pb.authStore.record?.id || 'guest'; const [mode, setMode] = useState('auto'); const [sessions, setSessions] = useState([]); const [weights, setWeights] = useState([]); const [goals, setGoals] = useState([]); const [material, setMaterial] = useState([]); const [minutes, setMinutes] = useState('');
  const [messages, setMessages] = useState(() => { try { const raw = localStorage.getItem(chatStorageKey(ownerId)); if (!raw) return []; const saved = JSON.parse(raw); if (!saved?.updatedAt || Date.now() - saved.updatedAt > CHAT_TTL_MS) { localStorage.removeItem(chatStorageKey(ownerId)); return []; } return Array.isArray(saved.messages) ? saved.messages : []; } catch (_) { return []; } });
  const [input, setInput] = useState(''); const [loading, setLoading] = useState(false); const endRef = useRef(null);
  useEffect(() => { const owner = pb.authStore.record?.id; if (!owner) return; Promise.all([pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }), pb.collection('bt_weights').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).catch(() => []), pb.collection('bt_goals').getFullList({ sort: '-created', filter: `owner = \"${owner}\"` }).catch(() => [])]).then(([s, w, g]) => { setSessions(s); setWeights(w); setGoals(g); }).catch(() => {}); }, []);
  const data = useMemo(() => ({ sessions, weights, goals, material, minutes }), [sessions, weights, goals, material, minutes]);
  useEffect(() => { if (!messages.length) { localStorage.removeItem(chatStorageKey(ownerId)); return; } localStorage.setItem(chatStorageKey(ownerId), JSON.stringify({ updatedAt: Date.now(), messages })); }, [messages, ownerId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  async function ask(question, forcedMode = mode) {
    const text = String(question || '').trim(); if (!text || loading) return;
    const user = { role: 'user', content: text }; setMessages(prev => [...prev, user, { role: 'assistant', content: '' }]); setInput(''); setLoading(true);
    try {
      const route = forcedMode === 'auto' ? (shouldUseLocal(text) ? 'local' : 'gemini') : forcedMode;
      if (route === 'local') { const answer = localCoachAnswer(text, data); setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; }); return; }
      const history = messages.filter(m => m.content).slice(-40);
      const response = await fetch(`/api/gemini?_=${Date.now()}`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ message: [{ type: 'text', text }], history, context: makeContext(data) }) });
      const raw = await response.text(); if (!response.ok) throw new Error((() => { try { return JSON.parse(raw)?.error || `Error ${response.status}`; } catch (_) { return `Error ${response.status}`; } })());
      const answer = JSON.parse(raw)?.answer; if (!answer) throw new Error('Gemini ha retornat una resposta buida.'); setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; });
    } catch (_) { const fallback = localFallback(text, data); setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: fallback }; return copy; }); }
    finally { setLoading(false); }
  }
  function clearConversation() { setMessages([]); localStorage.removeItem(chatStorageKey(ownerId)); }
  function switchMode(nextMode) { if (nextMode === mode) return; setMode(nextMode); setInput(''); }
  return <AppShell title="Assistent IA"><Helmet><title>Bomber Coach — BOMBER TRAINER</title></Helmet><div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}><p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH</p><p className="mt-2 text-sm text-slate-700">Tria com vols parlar amb el teu entrenador.</p><div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs font-semibold text-purple-700">{sessions.length} sessions</p>{messages.length > 0 && <button type="button" onClick={clearConversation} className="rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 border border-purple-100">🗑️ Esborrar conversa</button>}</div></div><div className="flex gap-2"><a href="/activitats" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-center text-sm font-bold text-slate-700">⌚ Veure activitats sincronitzades</a></div><div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5"><button onClick={() => switchMode('auto')} className={`rounded-xl px-2 py-3 text-sm font-bold transition ${mode === 'auto' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>🧠 Auto<span className="block text-[10px] font-medium opacity-70">Local + Gemini</span></button><button onClick={() => switchMode('local')} className={`rounded-xl px-2 py-3 text-sm font-bold transition ${mode === 'local' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>🟢 Local<span className="block text-[10px] font-medium opacity-70">Gratis</span></button><button onClick={() => switchMode('gemini')} className={`rounded-xl px-2 py-3 text-sm font-bold transition ${mode === 'gemini' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>🤖 Gemini<span className="block text-[10px] font-medium opacity-70">Obert</span></button></div>{(mode === 'auto' || mode === 'local') ? <div className="grid grid-cols-2 gap-2">{QUICK.map(q => <button key={q} onClick={() => ask(q, 'local')} disabled={loading} className="min-h-[52px] rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold shadow-sm">{q}</button>)}</div> : <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-slate-700"><b>🤖 Gemini</b><br />Pregunta el que vulguis sobre les teves dades, entrenament o preparació. Gemini rebrà el resum del Bomber Trainer.</div>}<div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[300px]">{messages.length === 0 && <div className="rounded-2xl bg-purple-50 p-4 text-sm text-slate-700"><b>Hola! 👋</b><br /><br />{mode === 'auto' ? 'Soc el Bomber Coach. Combino l’anàlisi local amb Gemini segons el que em preguntis.' : mode === 'local' ? 'Soc el Coach local. Tinc les teves dades i puc analitzar-les sense API i sense límit.' : 'Soc Gemini. Fes-me una pregunta específica i analitzaré les dades que tinc del Bomber Trainer.'}</div>}{messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content || (loading && i === messages.length - 1 ? 'Pensant…' : '')}</div></div>)}<div ref={endRef} /></div><form onSubmit={e => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm"><input value={input} onChange={e => setInput(e.target.value)} placeholder={mode === 'auto' ? 'Pregunta el que vulguis…' : mode === 'local' ? 'Pregunta sobre les teves dades…' : 'Escriu la pregunta per Gemini…'} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4"/><button type="submit" disabled={loading} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white">{loading ? '…' : 'Envia'}</button></form></AppShell>;
}
