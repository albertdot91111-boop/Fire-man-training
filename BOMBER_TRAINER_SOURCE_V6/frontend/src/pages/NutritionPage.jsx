import React,{useState} from 'react';
import Helmet from 'react-helmet';
import { Apple, ChevronDown } from 'lucide-react';
import AppShell from '@/components/AppShell';

const DAYS=[
 {day:'DILLUNS',type:'CARDIO',meals:[
  ['ESMORZAR','2 torrades espelta amb ½ alvocat i ou remenat'],
  ['POST-GIM','45 gr. batut proteïna + 1 plàtan'],
  ['DINAR','150 gr. quinoa saltejada amb verdures i 2 ous + 2 clares'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','250 gr. mongeta tendra amb 200 gr. calamars planxa'],
  ['POSTRES GANA','Iogurt Vopro natural amb 4 nous']]},
 {day:'DIMARTS',type:'GIM',meals:[
  ['ESMORZAR','150 gr. iogurt Skyr 0% + 60 gr. granola o civada + 1 plàtan i 4 nous'],
  ['POST-GIM','2 torrades espelta amb ½ alvocat + 45 gr. pavo'],
  ['DINAR','220 gr. pasta s/gluten amb verdures i 2 broquetes de pollastre al curri o 100 gr. pollastre'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','Hamburguesa de vedella eco amb ½ alvocat + 45 gr. formatge cottage + escarola'],
  ['POSTRES GANA','Iogurt Vopro coco amb ametlles']]},
 {day:'DIMECRES',type:'GIM',meals:[
  ['ESMORZAR','2 torrades espelta amb ½ alvocat i 70 gr. pavo'],
  ['POST-GIM','45 gr. batut proteïna + 1 plàtan'],
  ['DINAR','200 gr. llenties amb 200 gr. verdures i filet de peix blanc'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','Amanida + fruita, carbassó i 2 ous'],
  ['POSTRES GANA','Iogurt Vopro natural amb nabius']]},
 {day:'DIJOUS',type:'CARDIO',meals:[
  ['ESMORZAR','150 gr. iogurt Skyr 0% + 60 gr. granola o civada + 1 plàtan i 4 nous'],
  ['POST-GIM','2 torrades espelta amb ½ alvocat + 45 gr. pavo'],
  ['DINAR','250 gr. escalivada amb entrecot o filet de vedella o hamburguesa Heura'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','300 gr. bròquil forn amb moniato i salmó'],
  ['POSTRES GANA','Mató de cabra amb mel i nous']]},
 {day:'DIVENDRES',type:'GIM',meals:[
  ['ESMORZAR','2 torrades espelta amb ½ alvocat i ou remenat'],
  ['POST-GIM','45 gr. batut proteïna + 1 plàtan'],
  ['DINAR','200 gr. pollastre al curri amb 125 gr. arròs'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','Pizza de fajol amb verdures i tofu, xampinyons + formatge cottage'],
  ['POSTRES GANA','Iogurt Vopro coco amb ametlles']]},
 {day:'DISSABTE',type:'',meals:[
  ['ESMORZAR','150 gr. iogurt Skyr 0% + 60 gr. civada + 1 plàtan i 4 nous'],
  ['POST-GIM','Fruita i 30 gr. fruits secs'],
  ['DINAR','Lliure'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','Lliure'],
  ['POSTRES GANA','Lliure sense sucre']]},
 {day:'DIUMENGE',type:'',meals:[
  ['ESMORZAR','2 torrades espelta amb ½ alvocat i ou remenat'],
  ['POST-GIM','Fruita i 30 gr. fruits secs'],
  ['DINAR','220 gr. pasta s/gluten amb amanida de xerri + cavalla + ou'],
  ['BERENAR','Fruita al gust'],
  ['SOPAR','350 ml. crema de carbassa i truita 2 ous'],
  ['POSTRES GANA','Iogurt Vopro amb 4 nous']]}
];

const NOTES=[
 'Peix blau: Salmó, tonyina, sardines, seitons, bacallà, besuc, verat',
 'Peix blanc: Lluç, llenguado, rap, cap-roig, orada, gall, llobarro',
 'Marisc: Sèpia, calamars, gambes, llagostins, musclos, cloïsses, navalles…',
 'Carn blanca: Conill, pavo i pollastre',
 'Aliments a no incloure: al·lèrgia préssec i nous, lactosa, pera',
 '3 plats preferits: pollastre al curri, arròs'
];

export default function NutritionPage(){
 const [open,setOpen]=useState('DILLUNS');
 return <AppShell title="NUTRICIÓ">
  <Helmet><title>Nutrició — BOMBER TRAINER</title></Helmet>
  <section className="rounded-3xl bg-emerald-900 p-5 text-white shadow-sm">
   <p className="text-xs font-black tracking-[0.2em] text-emerald-200">MENÚ SETMANAL</p>
   <h2 className="mt-2 text-2xl font-black">Dieta de rendiment esportiu</h2>
   <p className="mt-2 text-sm leading-6 text-emerald-50">Menú guardat dins l’app per consultar-lo segons el dia.</p>
  </section>
  <div className="space-y-3">{DAYS.map(d=>{const expanded=open===d.day;return <article key={d.day} className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
   <button type="button" onClick={()=>setOpen(expanded?'':d.day)} className="flex w-full items-center justify-between p-4 text-left">
    <div><p className="text-xs font-black tracking-[0.18em] text-emerald-700">{d.type||'MENÚ'}</p><h3 className="mt-1 text-lg font-black">{d.day}</h3></div>
    <ChevronDown className={expanded?'h-5 w-5 rotate-180':'h-5 w-5'} />
   </button>
   {expanded&&<div className="border-t border-emerald-100 bg-emerald-50/40 p-3 space-y-2">{d.meals.map(([label,text])=><div key={label} className="rounded-2xl bg-white p-3 ring-1 ring-black/5"><p className="text-[10px] font-black tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold leading-5 text-slate-800">{text}</p></div>)}</div>}
  </article>})}</div>
  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Informació del menú</h2><ul className="mt-3 space-y-2">{NOTES.map(n=><li key={n} className="text-sm font-medium leading-5 text-slate-600">• {n}</li>)}</ul></section>
  <section className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm"><p className="text-xs font-black tracking-[0.18em] text-violet-700">SUPLEMENTACIÓ ESPORTIVA</p><div className="mt-3 space-y-2">{['Batut proteïna post entreno gimnàs fort','Creatina 7 gr. cada matí en dejú','Intenta arribar a 2 litres d’aigua al dia'].map((x,i)=><div key={x} className="flex gap-3 rounded-2xl bg-white p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{i+1}</span><p className="text-sm font-bold text-slate-800">{x}</p></div>)}</div></section>
 </AppShell>
}