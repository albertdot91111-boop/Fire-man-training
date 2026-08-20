import React, { useEffect, useMemo, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { diagnoseBomberProgress } from '@/aiEngine';

const QUICK = [
  'Com vaig?',
  'Què haig de millorar?',
  'Què faig avui?',
  'Quins punts febles tinc?',
  'Com evoluciono?',
  'Quant fa que no treballo cada prova?',
];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica', pit: 'Banca', cames: 'Cames', pressbanca: 'Press banca' };

function makeContext(data) {
  const diagnosis = diagnoseBomberProgress(data.sessions || []);
  return JSON.stringify({
    diagnosis,
    sessions: (data.sessions || []).slice(0, 20),
    weights: data.weights || [],
    goals: data.goals || [],
    material: data.material || [],
    minutes: data.minutes || '',
  });
}

function daysSince(date) {
  if (!date) return null;
  const t = Date.parse(date);
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 86400000)) : null;
}

function localCoachAnswer(question, data) {
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const diagnosis = diagnoseBomberProgress(sessions);
  const q = String(question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const latest = sessions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8);
  const focus = diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'pendent de més dades';

  if (q.includes('com vaig')) {
    const rows = diagnosis.tests.map((t) => {
      const pct = t.readiness?.progress ?? 0;
      const mark = t.latestTimeSeconds ? `${Math.round(t.latestTimeSeconds)} s` : 'sense registre';
      return `• **${t.label}**: ${pct}% · últim registre: ${mark}`;
    }).join('\n');
    return `### Com vas?\n\n**Prioritat actual:** ${focus}.\n\n${rows}\n\nEl percentatge és orientatiu i només es calcula quan hi ha un objectiu numèric configurat; sense registre és 0%. No considero la navette mentre no hi hagi confirmació oficial.`;
  }
  if (q.includes('millorar') || q.includes('punts febles')) {
    const priority = diagnosis.tests.filter((t) => t.latestTimeSeconds).sort((a, b) => (b.readiness?.progress ?? 0) - (a.readiness?.progress ?? 0))[0];
    return `### Què prioritzaria\n\n**${focus}**.\n\nMira sobretot la distància al teu objectiu, la tendència de les últimes sessions i les penalitzacions. Si hi ha poques dades, no assumiré que una prova és feble sense evidència.`;
  }
  if (q.includes('que faig avui') || q.includes('què faig avui')) {
    return `### Entrenament d'avui\n\n**Focus:** ${focus}.\n\n1. Escalfament 8–10 min.\n2. Treball específic de la prioritat, sense buscar màxim si vens carregat.\n3. Registra temps, repeticions i penalitzacions.\n4. Recuperació i mobilitat.\n\nLa següent sessió s'ha d'adaptar al resultat d'avui.`;
  }
  if (q.includes('evolucion') || q.includes('evolució')) {
    return `### Evolució recent\n\n${latest.length ? latest.map(s => `• ${s.date || 'sense data'} — ${LABELS[s.type] || s.type} — ${s.duration ? `${s.duration} min` : ''}${s.penalties ? ` · ${s.penalties} penalitzacions` : ''}`).join('\n') : 'Encara no hi ha sessions registrades.'}\n\nLa tendència s'ha de valorar amb diverses sessions, no amb una sola marca.`;
  }
  if (q.includes('quant fa') || q.includes('no treballo') || q.includes('ultim') || q.includes('últim')) {
    const types = ['estructural', 'forestal', 'aquatic', 'pressbanca', 'cames'];
    return `### Temps des de l'últim entrenament\n\n${types.map(type => {
      const row = sessions.filter(s => s.type === type).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
      const days = daysSince(row?.date);
      return `• **${LABELS[type]}**: ${days === null ? 'mai registrat' : `fa ${days} dies`}`;
    }).join('\n')}`;
  }
  return `### Anàlisi local\n\nHe revisat les dades disponibles de Bomber Trainer. Ara mateix la prioritat detectada és **${focus}**.\n\nPuc analitzar progrés, punts febles, evolució recent, entrenament recomanat i temps des de l'últim treball sense utilitzar cap API.`;
}

export default function AiPage() {
  const [mode, setMode] = useState('local');
  const [sessions, setSessions] = useState([]);
  const [weights, setWeights] = useState([]);
  const [goals, setGoals] = useState([]);
  const [material, setMaterial] = useState([]);
  const [minutes, setMinutes] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const owner = pb.authStore.record?.id;
    if (!owner) return;
    Promise.all([
      pb.collection('bt_sessions').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }),
      pb.collection('bt_weights').getFullList({ sort: '-date', filter: `owner = \"${owner}\"` }).catch(() => []),
      pb.collection('bt_goals').getFullList({ sort: '-created', filter: `owner = \"${owner}\"` }).catch(() => []),
    ]).then(([s, w, g]) => { setSessions(s); setWeights(w); setGoals(g); }).catch(() => {});
  }, []);

  const data = useMemo(() => ({ sessions, weights, goals, material, minutes }), [sessions, weights, goals, material, minutes]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function ask(question, forcedMode = mode) {
    const text = String(question || '').trim();
    if (!text || loading) return;
    const user = { role: 'user', content: text };
    setMessages(prev => [...prev, user, { role: 'assistant', content: '' }]);
    setInput(''); setLoading(true);
    try {
      if (forcedMode === 'local') {
        const answer = localCoachAnswer(text, data);
        setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; });
        return;
      }
      const history = messages.filter(m => m.content).slice(-10);
      const response = await fetch(`/api/gemini?_=${Date.now()}`, {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ message: [{ type: 'text', text }], history, context: makeContext(data) }),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error((() => { try { return JSON.parse(raw)?.error || `Error ${response.status}`; } catch (_) { return `Error ${response.status}`; } })());
      const answer = JSON.parse(raw)?.answer;
      if (!answer) throw new Error('Gemini ha retornat una resposta buida.');
      setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; });
    } catch (error) {
      setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: `No he pogut completar la consulta.\n\n${error.message}` }; return copy; });
    } finally { setLoading(false); }
  }

  function switchMode(nextMode) { if (nextMode === mode) return; setMode(nextMode); setInput(''); setMessages([]); }

  return <AppShell title="Assistent IA">
    <Helmet><title>Bomber Coach — BOMBER TRAINER</title></Helmet>
    <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
      <p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH</p>
      <p className="mt-2 text-sm text-slate-700">Tria com vols parlar amb el teu entrenador.</p>
      <p className="mt-2 text-xs font-semibold text-purple-700">{sessions.length} sessions</p>
    </div>
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
      <button onClick={() => switchMode('local')} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === 'local' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>🟢 Local<span className="block text-[11px] font-medium opacity-70">Gratis · il·limitat</span></button>
      <button onClick={() => switchMode('gemini')} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode === 'gemini' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>🤖 Gemini<span className="block text-[11px] font-medium opacity-70">Preguntes específiques</span></button>
    </div>
    {mode === 'local' ? <div className="grid grid-cols-2 gap-2">{QUICK.map(q => <button key={q} onClick={() => ask(q, 'local')} disabled={loading} className="min-h-[52px] rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold shadow-sm">{q}</button>)}</div> : <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-slate-700"><b>🤖 Gemini</b><br />Pregunta el que vulguis sobre les teves dades, entrenament o preparació. Gemini rebrà el resum de les dades del Bomber Trainer.</div>}
    <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[300px]">
      {messages.length === 0 && <div className="rounded-2xl bg-purple-50 p-4 text-sm text-slate-700"><b>Hola! 👋</b><br /><br />{mode === 'local' ? 'Soc el Coach local. Tinc les teves dades i puc analitzar-les sense API i sense límit.' : 'Soc Gemini. Fes-me una pregunta específica i analitzaré les dades que tinc del Bomber Trainer.'}</div>}
      {messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content || (loading && i === messages.length - 1 ? 'Pensant…' : '')}</div></div>)}
      <div ref={endRef} />
    </div>
    <form onSubmit={e => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm">
      <input value={input} onChange={e => setInput(e.target.value)} placeholder={mode === 'local' ? 'Pregunta sobre les teves dades…' : 'Escriu la pregunta per Gemini…'} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" />
      <button type="submit" disabled={loading} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white">{loading ? '…' : 'Envia'}</button>
    </form>
  </AppShell>;
}
