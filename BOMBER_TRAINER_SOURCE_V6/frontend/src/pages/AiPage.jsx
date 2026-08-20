import React, { useEffect, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';

const QUICK = ['Com vaig?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?'];

function readSSE(text) {
  const events = text.split(/\n\n/);
  let answer = '';
  for (const event of events) {
    const line = event.split('\n').find(x => x.startsWith('data: '));
    if (!line) continue;
    try { const item = JSON.parse(line.slice(6)); if (item?.type === 'content') answer += item.data?.content || ''; } catch (_) {}
  }
  return answer.trim();
}

function makeContext(data) {
  const sessions = (data.sessions || []).slice(0, 20).map(s => ({ date: s.date, type: s.type, data: s.data, notes: s.notes }));
  return `DADES REALS DEL BOMBER TRAINER\nSessions recents: ${JSON.stringify(sessions)}\nPes: ${JSON.stringify(data.weights || [])}\nObjectius: ${JSON.stringify(data.goals || [])}\nMaterial: ${JSON.stringify(data.material || [])}`;
}

export default function AiPage() {
  const [data, setData] = useState({ sessions: [], weights: [], goals: [], material: [] });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const owner = pb.authStore.record?.id;
    if (!owner) return;
    const filter = `owner = "${owner}"`;
    Promise.all([
      pb.collection('bt_sessions').getFullList({ sort: '-date', filter }).catch(() => []),
      pb.collection('bt_weights').getFullList({ sort: '-date', filter }).catch(() => []),
      pb.collection('bt_goals').getFullList({ sort: '-created', filter }).catch(() => []),
      pb.collection('bt_settings').getFullList({ sort: '-created', filter }).catch(() => [])
    ]).then(([sessions, weights, goals, settings]) => setData({ sessions, weights, goals, material: settings[0]?.material || [] }));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function ask(text) {
    const question = String(text || '').trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    setLoading(true);
    try {
      const history = messages.filter(m => m.content).slice(-10);
      const prompt = `${question}\n\n[CONTEXT BOMBER TRAINER]\n${makeContext(data)}\n\nAnalitza aquestes dades com a Bomber Coach. No inventis dades. La navette no està confirmada i no s'ha d'incloure com a prova activa.`;
      const response = await fetch(`/api/integrated-ai?_=${Date.now()}`, {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ message: [{ type: 'text', text: prompt }], history })
      });
      const raw = await response.text();
      if (!response.ok) throw new Error((() => { try { return JSON.parse(raw)?.error || `Error ${response.status}`; } catch (_) { return `Error ${response.status}`; } })());
      const answer = readSSE(raw);
      if (!answer) throw new Error('La IA ha retornat una resposta buida.');
      setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: answer }; return copy; });
    } catch (error) {
      setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: `No he pogut connectar amb la IA.\n\n${error.message}` }; return copy; });
    } finally { setLoading(false); }
  }

  return <AppShell title="Assistent IA">
    <Helmet><title>Bomber Coach — BOMBER TRAINER</title></Helmet>
    <div className="rounded-3xl p-5" style={{ backgroundColor: '#f3e8ff', borderLeft: '8px solid #7c3aed' }}>
      <p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH · ENTRENADOR IA</p>
      <p className="mt-2 text-sm text-slate-700">Analitzo les teves dades d'entrenament i t'ajudo a decidir què millorar, què entrenar i com preparar les proves.</p>
      <p className="mt-2 text-xs font-semibold text-purple-700">{data.sessions.length} sessions registrades · navette no activa fins a confirmació oficial.</p>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {QUICK.map(q => <button key={q} onClick={() => ask(q)} disabled={loading} className="min-h-[44px] rounded-xl bg-white border border-slate-200 px-3 text-sm font-semibold">{q}</button>)}
    </div>
    <div className="space-y-3 rounded-3xl bg-white border border-slate-200 p-4 shadow-sm min-h-[300px]">
      {messages.length === 0 && <div className="rounded-2xl bg-purple-50 p-4 text-sm text-slate-700"><b>Hola! 👋</b><br/><br/>Sóc el teu Bomber Coach. Puc analitzar el teu progrés, detectar punts febles, proposar l'entrenament d'avui, adaptar la setmana i respondre dubtes sobre la preparació de Bombers.</div>}
      {messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}><div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content || (loading && i === messages.length - 1 ? 'Pensant…' : '')}</div></div>)}
      <div ref={endRef} />
    </div>
    <form onSubmit={e => { e.preventDefault(); ask(input); }} className="sticky bottom-24 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm">
      <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escriu la teva pregunta…" className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4" />
      <button type="submit" disabled={loading} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white">{loading ? '…' : 'Envia'}</button>
    </form>
  </AppShell>;
}
