import React,{useMemo,useState} from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';

const EXERCISES=[
 {name:'Press banca',series:4,reps:12,sources:'Sessió 1 i 5'},
 {name:'Remo amb manuelles unilateral',series:4,reps:12,sources:'Sessió 1'},
 {name:'Zancada frontal amb 2 manuelles',series:4,reps:15,sources:'Sessió 1 i 5',unit:'passos'},
 {name:'Sentadilla frontal (Front Squat)',series:4,reps:12,sources:'Sessió 4'},
 {name:'Peso muerto rumano',series:4,reps:12,sources:'Sessió 4'},
 {name:'Marxa del granger amb KB',series:4,reps:40,sources:'Sessió 4',unit:'seg'},
 {name:'Rack Chin (TRX)',series:4,reps:12,sources:'Sessió 5'},
 {name:'Peso muerto amb barra hexagonal (Trap Bar)',series:4,reps:5,sources:'Sessió 10'},
 {name:'Dominades',series:4,reps:4,sources:'Sessió 10'},
 {name:'Landmine unilateral en lunge',series:4,reps:6,sources:'Sessió 10'},
 {name:'Remo amb barra en banc · agafada prona',series:4,reps:8,sources:'Sessió 10'},
 {name:'Hip thrust en banc',series:4,reps:8,sources:'Sessió 10'},
 {name:'Peso muerto con barra',series:4,reps:5,sources:'Sessió 17'},
 {name:'Flexiones',series:4,reps:4,sources:'Sessió 17'},
 {name:'Squat búlgara',series:4,reps:8,sources:'Sessió 17'},
 {name:'Remo TRX con kettlebell',series:4,reps:6,sources:'Sessió 17',unit:'costat'},
 {name:'Core con fitball',series:3,reps:10,sources:'Sessió 17'},
 {name:'Activació flexors de maluc + core amb goma',series:3,reps:5,sources:'Sessió 17',unit:'costat'}
];

const KEY='bomber-trainer-base-forca-v1';
function readSaved(){
 try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}
}

export default function BaseStrengthPage(){
 const [values,setValues]=useState(readSaved);
 const update=(name,key,value)=>setValues(prev=>{const next={...prev,[name]:{...(prev[name]||{}),[key]:value}};localStorage.setItem(KEY,JSON.stringify(next));return next});
 const grouped=useMemo(()=>EXERCISES,[ ]);
 return <AppShell title="BASE · FORÇA">
  <Helmet><title>Base · Força — BOMBER TRAINER</title></Helmet>
  <section className="rounded-3xl bg-orange-500 p-5 text-white shadow-sm">
   <p className="text-xs font-black tracking-[0.2em] text-orange-100">BASE DE FORÇA</p>
   <h1 className="mt-2 text-2xl font-black">Exercicis de força de l’entrenador</h1>
   <p className="mt-2 text-sm leading-6 text-orange-50">Pots modificar el pes i les repeticions de cada exercici. Les sèries i objectius parteixen de les pautes guardades.</p>
  </section>
  <div className="space-y-3">
   {grouped.map((ex,index)=>{const v=values[ex.name]||{};return <article key={ex.name} className="rounded-3xl border border-orange-100 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-widest text-orange-600">EXERCICI {index+1}</p><h2 className="mt-1 text-base font-black text-slate-900">{ex.name}</h2><p className="mt-1 text-xs font-semibold text-slate-400">{ex.series} × {ex.reps}{ex.unit?' '+ex.unit:''} · {ex.sources}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">DESCANS PENDENT</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <label className="grid gap-1 text-xs font-bold text-slate-500">Pes (kg)<input type="number" min="0" step="0.5" value={v.weight??''} onChange={e=>update(ex.name,'weight',e.target.value)} placeholder="kg" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold"/></label>
      <label className="grid gap-1 text-xs font-bold text-slate-500">Repeticions<input type="number" min="0" value={v.reps??ex.reps} onChange={e=>update(ex.name,'reps',e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-base font-bold"/></label>
    </div>
    <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">Sèries: {ex.series} · Descans entre sèries: <span className="text-orange-600">PENDENT DE CONFIRMAR</span></div>
   </article>})}
  </div>
 </AppShell>
}