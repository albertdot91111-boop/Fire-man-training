import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { diagnoseBomberProgress } from '@/aiEngine';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Aquàtica', pit: 'Banca', cames: 'Cames' };

function makeContext(data) {
  const sessions = (data.sessions || []).slice(0, 20).map(s => ({ date: s.date, type: s.type, duration: s.duration, penalties: s.penalties, points: s.points, data: s.data, notes: s.notes }));
  return `DADES REALS DEL BOMBER TRAINER\nSessions recents: ${JSON.stringify(sessions)}\nPes: ${JSON.stringify(data.weights || [])}\nObjectius: ${JSON.stringify(data.goals || [])}\nMaterial: ${JSON.stringify(data.material || [])}`;
}

function localCoachAnswer(question, data) {
  const sessions = data.sessions || [];
  const diagnosis = diagnoseBomberProgress(sessions);
  const tests = (diagnosis.tests || []).filter(t => t.sessions > 0);
  const q = question.toLowerCase();
  const latest = sessions.slice().sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))).slice(0, 5);
  if (!tests.length) return `Encara no tinc prou dades per fer una valoració completa. Tens ${sessions.length} sessions registrades. Continua registrant entrenaments i podré detectar tendències i prioritats.`;
  if (q.includes('com vaig')) {
    const lines = tests.map(t => `• ${t.label}: últim ${t.latestTimeSeconds ? `${Math.round(t.latestTimeSeconds)} s` : 'pendent'} · millor ${t.bestTimeSeconds ? `${Math.round(t.bestTimeSeconds)} s` : '—'}`);
    return `### Com vas ara\n\n${lines.join('\n')}\n\n**Prioritat actual:** ${diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'pendent'}.\n\nAquesta valoració utilitza només les dades registrades. La navette no està activa ni confirmada.`;
  }
  if (q.includes('punts febles')) {
    const ranked = tests.slice().sort((a,b) => (b.trendSeconds || 0) - (a.trendSeconds || 0));
    return `### Punts febles\n\n${ranked.map((t,i) => `${i+1}. **${t.label}** — ${t.trendSeconds > 0 ? `tendència negativa (+${Math.round(t.trendSeconds)} s)` : t.trendSeconds < 0 ? `millora (${Math.abs(Math.round(t.trendSeconds))} s)` : 'estable'}`).join('\n')}\n\n**Prioritat:** ${diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'pendent'}.`;
  }
  if (q.includes('millorar')) {
    const p = diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'la prova amb més marge de millora';
    return `### Què milloraria primer\n\n**1. ${p}**\n\nÉs la prioritat que surt de les dades actuals. No augmentaria volum i intensitat alhora. Registra les properes sessions perquè el Coach pugui comprovar si la tendència canvia.`;
  }
  if (q.includes('què faig avui') || q.includes('que faig avui')) {
    const focus = diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'Forestal';
    return `### Entrenament d'avui\n\n**Focus:** ${focus}\n\n1. Escalfament 8–10 min.\n2. Treball específic de la prioritat, sense buscar màxim si vens carregat.\n3. Registra temps, repeticions i penalitzacions.\n4. Recuperació i mobilitat.\n\nEl proper entrenament s'ha d'adaptar al resultat d'avui.`;
  }
  if (q.includes('últim') || q.includes('ultim') || q.includes('evolució') || q.includes('evolucio')) {
    return `### Evolució recent\n\n${latest.map(s => `• ${s.date || 'sense data'} — ${LABELS[s.type] || s.type} — ${s.duration ? `${s.duration} min` : ''}${s.penalties ? ` · ${s.penalties} penalitzacions` : ''}`).join('\n')}\n\nSi em preguntes per una prova concreta, puc centrar l'anàlisi en aquella prova.`;
  }
  return `### Anàlisi local\n\nHe revisat les dades disponibles de Bomber Trainer. Ara mateix la prioritat detectada és **${diagnosis.priority ? LABELS[diagnosis.priority] || diagnosis.priority : 'pendent de més dades'}**.\n\nPuc analitzar progrés, punts febles, evolució recent i entrenament recomanat sense utilitzar cap API.\n\nPer a una pregunta molt específica i oberta, pots utilitzar **Pregunta a Gemini**.`;
}

export default function AiPage() {
  const [data, setData] = useState({ sessions: [], weights: [], goals: [], material: [] });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('local');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    const owner = pb.authStore.record?.id;
    if (!owner) return;
    const filter = `owner = \"${owner}\"`;
    Promise.all([
      pb.collection('bt_sessions').getFullList({ sort: '-date', filter }).catch(() => []),
      pb.collection('bt_weights').getFullList({ sort: '-date', filter }).catch(() => []),
      pb.collection('bt_goals').getFullList({ sort: '-created', filter }).catch(() => []),
      pb.collection('bt_settings').getFullList({ sort: '-created', filter }).catch(() => [])
    ]).then(([sessions, weights, goals, settings]) => setData({ sessions, weights, goals, material: settings[0]?.material || [] }));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function ask(text, forcedMode = mode) {
    const question = String(text || '').trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setLoading(true);
    try {
      if (forcedMode === 'local') {
        const answer = localCoachAnswer(question, data);
        setMessages(prev => { const copy=[...prev]; copy[copy.length-1]={ role:'assistant', content:answer }; return copy; });
        return;
      }
      const history = messages.filter(m => m.content).slice(-10);
      const response = await fetch(`/api/gemini?_=${Date.now()}`, {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ message: [{ type: 'text', text: question }], history, context: makeContext(data) })
      });
      const raw = await response.text();
      if (!response.ok) throw new Error((() => { try { return JSON.parse(raw)?.error || `Error ${response.status}`; } catch (_) { return `Error ${response.status}`; } })());
      const answer = JSON.parse(raw)?.answer;
      if (!answer) throw new Error('Gemini ha retornat una resposta buida.');
      setMessages(prev => { const copy=[...prev]; copy[copy.length-1]={ role:'assistant', content:answer }; return copy; });
    } catch (error) {
      setMessages(prev => { const copy=[...prev]; copy[copy.length-1]={ role:'assistant', content:`No he pogut completar la consulta.\n\n${error.message}` }; return copy; });
    } finally { setLoading(false); }
  }

  function switchMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    setInput('');
    setMessages([]);
  }

  return <AppShell title="Assistent IA">
    <Helmet><title>Bomber Coach — BOMBER TRAINER</title></Helmet>
    <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
      <p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH</p>
      <p className="mt-2 text-sm text-slate-700">Tria com vols parlar amb el teu entrenador.</p>
      <p className="mt-2 text-xs font-semibold text-purple-700">{data.sessions.length} sessions · navette no activa fins a confirmació oficial.</p>
    </div>

    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
      <button onClick={() => switchMode('local')} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode==='local' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>
        🟢 Local
        <span className="block text-[11px] font-medium opacity-70">Gratis · il·limitat</span>
      </button>
      <button onClick={() => switchMode('gemini')} className={`rounded-xl px-3 py-3 text-sm font-bold transition ${mode==='gemini' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600'}`}>
        🤖 Gemini
        <span className="block text-[11px] font-medium opacity-70">Preguntes específiques</span>
      </button>
    </div>

    {mode === 'local' ? <div className="grid grid-cols-2 gap-2">
      {QUICK.map(q => <button key={q} onClick={() => ask(q, 'local')} disabled={loading} className="min-h-[52px] rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold shadow-sm">{q}</button>)}
    </div> : <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-slate-700">
      <b>🤖 Gemini</b><br/>Pregunta el que vulguis sobre les teves dades, entrenament o preparació. Gemini rebrà el resum de les dades del Bomber Trainer.
    </div>}

    <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[300px]">
      {messages.length === 0 && <div className="rounded-2xl bg-purple-50 p-4 text-sm text-slate-700"><b>Hola! 👋</b><br/><br/>{mode === 'local' ? 'Soc el Coach local. Tinc les teves dades i puc analitzar-les sense API i sense límit.' : 'Soc Gemini. Fes-me una pregunta específica i analitzaré les dades que tinc del Bomber Trainer.'}</div>}
      {messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content || (loading && i === messages.length - 1 ? 'Pensant…' : '')}</div></div>)}
      <div ref={endRef} />
    </div>

    <form onSubmit={e => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm">
      <input value={input} onChange={e => setInput(e.target.value)} placeholder={mode === 'local' ? 'Pregunta sobre les teves dades…' : 'Escriu la pregunta per Gemini…'} className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" />
      <button type="submit" disabled={loading} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white">{loading ? '…' : 'Envia'}</button>
    </form>
  </AppShell>;
}
