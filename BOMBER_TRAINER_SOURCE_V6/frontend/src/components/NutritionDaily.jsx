import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';

const STORAGE_PREFIX = 'bt_nutrition_';
const FREE_MEAL_PREFIX = 'bt_nutrition_free_meal_';
const MOTIVATION = ['La preparació també es construeix a taula. 🔥','Entrenar fort és una part. Menjar bé és l’altra. 💪','Avui has fet una altra passa cap al bomber que vols ser. 🚒','Disciplina també vol dir cuidar el que menges. 👊','Un dia ben fet. Demà, un altre. Mantén la ratxa. 🔥'];
const FREE_MEAL_MESSAGES = ['😎 Avui toca gaudir! És el teu àpat lliure de la setmana. Sense culpa. Demà tornem al pla. 🔥','🍕 Àpat lliure activat! Gaudeix-lo. Un àpat no espatlla una bona setmana. 💪','❤️ La constància no és fer-ho perfecte. Gaudeix del teu àpat lliure i demà continuem.','😏 Avui hi ha capritx. Perfecte! Gaudeix-lo i demà tornem a la rutina.'];
function dateKey(date = new Date()) { const y = date.getFullYear(); const m = String(date.getMonth()+1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function weekKey(date = new Date()) { const d = new Date(date.getFullYear(),date.getMonth(),date.getDate()); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); return dateKey(d); }
function storageKey(owner,date){return `${STORAGE_PREFIX}${owner||'guest'}_${date}`;}
function freeMealKey(owner,week){return `${FREE_MEAL_PREFIX}${owner||'guest'}_${week}`;}
export function readNutritionStatus(owner,date){try{const value=localStorage.getItem(storageKey(owner,date));return ['good','bad','free_meal'].includes(value)?value:null;}catch(_){return null;}}
function writeStatus(owner,date,value){try{localStorage.setItem(storageKey(owner,date),value);}catch(_){}
}
function hasFreeMeal(owner,week){try{return localStorage.getItem(freeMealKey(owner,week))==='1';}catch(_){return false;}}
function useFreeMeal(owner,week){try{localStorage.setItem(freeMealKey(owner,week),'1');}catch(_){}
}

export default function NutritionDaily(){
  const location=useLocation();
  const owner=pb.authStore.record?.id||'guest';
  const [now,setNow]=useState(new Date());
  const [status,setStatus]=useState(()=>readNutritionStatus(owner,dateKey()));
  const [open,setOpen]=useState(false);
  const [manualOpen,setManualOpen]=useState(false);
  const [permission,setPermission]=useState(typeof Notification!=='undefined'?Notification.permission:'unsupported');
  const today=useMemo(()=>dateKey(now),[now]);
  const week=useMemo(()=>weekKey(now),[now]);
  const freeMealUsed=useMemo(()=>hasFreeMeal(owner,week),[owner,week,status]);
  const due=useMemo(()=>now.getHours()>=20&&!status,[now,status]);

  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{setStatus(readNutritionStatus(owner,today));},[owner,today]);
  useEffect(()=>{
    if(!due)return;
    setOpen(true);
    if(permission==='granted'){
      const notificationKey=`bt_nutrition_notified_${owner}_${today}`; let already=false;
      try{already=localStorage.getItem(notificationKey)==='1';}catch(_){}
      if(!already){try{new Notification('🍽️ Com has anat avui?',{body:'Marca el teu dia o gaudeix del teu àpat lliure de la setmana.',tag:'bt-nutrition-daily'});}catch(_){} try{localStorage.setItem(notificationKey,'1');}catch(_){} }
    }
  },[due,permission,owner,today]);
  const save=(value)=>{if(value==='free_meal')useFreeMeal(owner,week);writeStatus(owner,today,value);setStatus(value);setOpen(false);setManualOpen(false);window.dispatchEvent(new CustomEvent('bt:nutrition-updated',{detail:{date:today,status:value,owner}}));};
  const requestNotifications=async()=>{if(typeof Notification==='undefined')return;try{setPermission(await Notification.requestPermission());}catch(_){} };

  useEffect(()=>{
    if(location.pathname!=='/progres')return undefined;
    let timer=null;
    const decorateCalendar=()=>{
      const heading=Array.from(document.querySelectorAll('h2')).find(el=>el.textContent?.trim()==='Calendari del mes');
      const section=heading?.closest('section');
      if(!section)return;
      const buttons=Array.from(section.querySelectorAll('button'));
      const base=new Date(now.getFullYear(),now.getMonth(),1);
      buttons.forEach(button=>{
        button.querySelectorAll('[data-bt-nutrition-marker]').forEach(marker=>marker.remove());
        const dayText=button.querySelector(':scope > span')?.textContent?.trim()||button.querySelector('span')?.textContent?.trim()||'';
        const day=Number(dayText);
        if(!Number.isInteger(day)||day<1||day>31)return;
        const key=dateKey(new Date(base.getFullYear(),base.getMonth(),day));
        const markerStatus=readNutritionStatus(owner,key);
        if(!markerStatus)return;
        button.style.position='relative';
        const marker=document.createElement('span');
        marker.dataset.btNutritionMarker='1';
        marker.title=markerStatus==='free_meal'?'Àpat lliure de la setmana':markerStatus==='good'?'Nutrició correcta':'Nutrició a millorar';
        marker.textContent=markerStatus==='free_meal'?'🍕':markerStatus==='good'?'✓':'×';
        marker.style.cssText=`position:absolute;right:4px;bottom:3px;width:19px;height:19px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:white;background:${markerStatus==='good'||markerStatus==='free_meal'?'#16a34a':'#dc2626'};box-shadow:0 1px 3px rgba(0,0,0,.18);z-index:20;pointer-events:none;`;
        button.appendChild(marker);
      });
    };
    const schedule=()=>{if(timer)window.clearTimeout(timer);timer=window.setTimeout(decorateCalendar,40);};
    const observer=new MutationObserver(schedule);
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('bt:nutrition-updated',schedule);
    schedule();
    return()=>{observer.disconnect();window.removeEventListener('bt:nutrition-updated',schedule);if(timer)window.clearTimeout(timer);};
  },[location.pathname,owner,now,status]);

  if(!pb.authStore.isValid)return null;
  const dialogOpen=(open&&due)||(manualOpen&&!status);
  return <>
    {!status&&!due&&!manualOpen&&<button type="button" onClick={()=>setManualOpen(true)} className="fixed bottom-24 left-4 z-50 rounded-full border border-green-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-800 shadow-xl">🍽️ Revisar nutrició ara</button>}
    {due&&!open&&<button type="button" onClick={()=>setOpen(true)} className="fixed bottom-24 right-4 z-50 rounded-full bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-xl">🍽️ Nutrició d'avui</button>}
    {dialogOpen&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="nutrition-heading"><section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-green-700">CONTROL DIARI</p><h2 id="nutrition-heading" className="mt-1 text-2xl font-extrabold">🍽️ Com has anat avui?</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">20:00</span></div><p className="mt-3 text-sm font-medium text-slate-600">Has seguit el teu pla avui? I recorda: tens <strong>1 àpat lliure per setmana</strong>.</p><p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{status==='free_meal'?FREE_MEAL_MESSAGES[now.getDate()%FREE_MEAL_MESSAGES.length]:MOTIVATION[now.getDate()%MOTIVATION.length]}</p><div className={`mt-5 grid ${freeMealUsed?'grid-cols-2':'grid-cols-3'} gap-2`}><button type="button" onClick={()=>save('good')} className="min-h-[64px] rounded-2xl bg-green-600 px-2 text-sm font-extrabold text-white">🟢 Pla complert</button>{!freeMealUsed&&<button type="button" onClick={()=>save('free_meal')} className="min-h-[64px] rounded-2xl bg-amber-500 px-2 text-sm font-extrabold text-white">🍕 Àpat lliure</button>}<button type="button" onClick={()=>save('bad')} className="min-h-[64px] rounded-2xl bg-red-600 px-2 text-sm font-extrabold text-white">🔴 Fora del pla</button></div>{freeMealUsed&&<p className="mt-3 text-center text-xs font-bold text-amber-700">🍕 Ja has utilitzat l'àpat lliure d'aquesta setmana.</p>}{permission!=='granted'&&permission!=='unsupported'&&<button type="button" onClick={requestNotifications} className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">🔔 Activar notificacions</button>}<button type="button" onClick={()=>{setOpen(false);setManualOpen(false);}} className="mt-3 w-full py-2 text-sm font-bold text-slate-400">Tancar</button><p className="mt-2 text-center text-xs text-slate-400">🟢 dia complert · 🍕 àpat lliure · 🔴 dia fora del pla</p></section></div>}
  </>;
}
