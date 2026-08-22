import React, { useEffect, useMemo, useRef, useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import pb from '@/lib/pocketbaseClient';
import { diagnoseCurrentPriority } from '@/bomberPriority';
import { routeAiQuestion } from '@/aiRouter';

const QUICK = ['Com vaig?', 'Com comparo Forestal i Estructural?', 'Què haig de millorar?', 'Què faig avui?', 'Quins punts febles tinc?', 'Com evoluciono?'];
const LABELS = { forestal: 'Forestal', estructural: 'Estructural', aquatic: 'Piscina/Aquàtica', pressbanca: 'Press banca', cames: 'Cames' };

function localAnswer(question, data) {
  const q = String(question || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const diagnosis = diagnoseCurrentPriority(data.sessions || []);
  const focus = LABELS[diagnosis.priority] || diagnosis.priority || 'pendent de dades';
  const has = (...terms) => terms.some(t => q.includes(t));
  const compare = diagnosis.comparison || {};
  const comparisonText = () => {
    const f = compare.forestal, e = compare.estructural;
    if (!f && !e) return 'Encara no hi ha prou dades de Forestal i Estructural per comparar-les.';
    const line = (t) => t ? `**${t.label}**: ${t.latestTimeSeconds ? `${Math.round(t.latestTimeSeconds)} s` : 'sense temps'} · millor ${t.bestTimeSeconds ? `${Math.round(t.bestTimeSeconds)} s` : 'sense registre'}${t.penaltiesLatest ? ` · ${t.penaltiesLatest} penalitzacions` : ''}` : 'sense dades';
    return `### Forestal vs Estructural\n\n• ${line(f)}\n• ${line(e)}\n\n**Prioritat actual:** ${focus}.\n\nLa prioritat només compara aquestes dues proves. **Piscina/Aquàtica i Press banca no entren en el càlcul de prioritats fins que surtin les noves bases.**`;
  };
  if (has('hola', 'bon dia', 'bona tarda', 'bona nit')) return `### Bomber Coach\n\nLa prioritat activa és **${focus}**. Ara estic comparant **Forestal i Estructural**.`;
  if (has('compara', 'comparar', 'forestal i estructural', 'forestal vs estructural')) return comparisonText();
  if (has('com vaig', 'com estic', 'progres', 'preparacio', 'preparació')) return comparisonText();
  if (has('millorar', 'punt feble', 'punts febles', 'prioritat')) return `### Prioritat\n\n**${focus}**.\n\nLa prioritat surt exclusivament de la comparació **Forestal vs Estructural**. Piscina/Aquàtica i Press banca estan temporalment fora del càlcul.`;
  if (has('avui', 'entreno', 'entrenar')) return `### Entrenament d'avui\n\n**Focus:** ${focus}.\n\nTreballa la prioritat actual sense convertir-ho en un test màxim si tens fatiga. Registra temps i penalitzacions per poder comparar la següent sessió.`;
  if (has('evolucio', 'evolució', 'millora', 'millorat')) {
    const active = (data.sessions || []).filter(s => s.type === 'forestal' || s.type === 'estructural');
    const rows = active.slice().sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))).slice(0,8).map(s => `• ${s.date || 'Sense data'} — **${LABELS[s.type] || s.type}**${s.points != null ? ` · ${s.points} punts` : ''}${s.penalties ? ` · ${s.penalties} penalitzacions` : ''}`).join('\n');
    return `### Evolució Forestal + Estructural\n\n${rows || 'Encara no hi ha sessions suficients.'}`;
  }
  return `### Coach local\n\nLa prioritat actual és **${focus}**.\n\nEstic prioritzant **Forestal + Estructural** i comparant-les entre si. Piscina/Aquàtica i Press banca queden fora de prioritats fins a les noves bases.`;
}

function contextFor(data) {
  const diagnosis = diagnoseCurrentPriority(data.sessions || []);
  return JSON.stringify({ diagnosis, priorityPolicy: 'Prioritzar i comparar només Forestal vs Estructural. Aquàtica/Piscina i Press banca fora de prioritats fins a noves bases.', sessions: (data.sessions || []).slice(0,150), weights: data.weights || [], goals: data.goals || [] });
}

export default function AiPageAuto() {
  const owner = pb.authStore.record?.id;
  const [sessions,setSessions] = useState([]), [weights,setWeights] = useState([]), [goals,setGoals] = useState([]);
  const [messages,setMessages] = useState([]), [input,setInput] = useState(''), [loading,setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(() => {
    if (!owner) return;
    Promise.all([
      pb.collection('bt_sessions').getFullList({sort:'-date', filter:`owner = \"${owner}\"`}),
      pb.collection('bt_weights').getFullList({sort:'-date', filter:`owner = \"${owner}\"`}).catch(()=>[]),
      pb.collection('bt_goals').getFullList({sort:'-created', filter:`owner = \"${owner}\"`}).catch(()=>[])
    ]).then(([s,w,g])=>{setSessions(s);setWeights(w);setGoals(g);}).catch(()=>{});
  },[owner]);
  const data = useMemo(()=>({sessions,weights,goals}),[sessions,weights,goals]);
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[messages,loading]);

  async function ask(question){
    const text=String(question||'').trim(); if(!text||loading)return;
    setMessages(p=>[...p,{role:'user',content:text},{role:'assistant',content:'',source:'thinking'}]); setInput(''); setLoading(true);
    const route=routeAiQuestion(text,data);
    try {
      if(route.engine==='local') {
        const answer=localAnswer(text,data);
        setMessages(p=>{const c=[...p];c[c.length-1]={role:'assistant',content:answer,source:'local'};return c;});
        return;
      }
      const history=messages.filter(m=>m.content).slice(-40);
      const r=await fetch(`/api/gemini?_=${Date.now()}`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:[{type:'text',text}],history,context:contextFor(data)})});
      const raw=await r.text(); let parsed=null; try{parsed=JSON.parse(raw);}catch{}
      if(!r.ok||!parsed?.answer) throw new Error(parsed?.error||`Error ${r.status}`);
      setMessages(p=>{const c=[...p];c[c.length-1]={role:'assistant',content:parsed.answer,source:parsed.source||'gemini'};return c;});
    } catch {
      const answer=localAnswer(text,data);
      setMessages(p=>{const c=[...p];c[c.length-1]={role:'assistant',content:`${answer}\n\n*Gemini no està disponible. He continuat automàticament amb el Coach local.*`,source:'local-fallback'};return c;});
    } finally {setLoading(false);}
  }

  return <AppShell title="Assistent IA"><Helmet><title>Bomber Coach — IA automàtica</title></Helmet>
    <div className="rounded-3xl p-5" style={{backgroundColor:'#f3e8ff',borderLeft:'8px solid #7c3aed'}}>
      <p className="text-xs font-bold tracking-widest text-purple-700">BOMBER COACH · AUTO</p>
      <p className="mt-2 text-sm text-slate-700">El Router decideix automàticament entre IA local i Gemini.</p>
      <p className="mt-2 text-xs font-semibold text-purple-700">Prioritat: FORESTAL + ESTRUCTURAL · Piscina/Aquàtica i Press banca desactivades fins a noves bases.</p>
      <p className="mt-2 text-xs font-semibold text-purple-700">{sessions.length} sessions disponibles</p>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">{QUICK.map(q=><button key={q} onClick={()=>ask(q)} disabled={loading} className="rounded-full bg-white border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{q}</button>)}</div>
    <div className="mt-4 space-y-3 rounded-3xl bg-white border border-slate-200 p-4 min-h-[320px]">{messages.map((m,i)=><div key={i} className={m.role==='user'?'text-right':'text-left'}><div className={`inline-block max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${m.role==='user'?'bg-slate-900 text-white':'bg-slate-100 text-slate-800'}`}>{m.content || 'Pensant…'}</div></div>)}<div ref={endRef}/></div>
    <form onSubmit={e=>{e.preventDefault();ask(input)}} className="sticky bottom-24 mt-4 flex gap-2 rounded-3xl bg-white border border-slate-200 p-3 shadow-sm"><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Pregunta al Bomber Coach..." className="min-h-[48px] flex-1 rounded-xl border border-slate-300 px-4"/><button type="submit" disabled={loading||!input.trim()} className="min-h-[48px] rounded-xl bg-purple-700 px-5 font-bold text-white">{loading?'…':'Envia'}</button></form>
  </AppShell>;
}
