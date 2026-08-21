import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';

const STORAGE_PREFIX = 'bt_nutrition_';
const MOTIVATION = [
  'La preparació també es construeix a taula. 🔥',
  'Entrenar fort és una part. Menjar bé és l’altra. 💪',
  'Avui has fet una altra passa cap al bomber que vols ser. 🚒',
  'Disciplina també vol dir cuidar el que menges. 👊',
  'Un dia ben fet. Demà, un altre. Mantén la ratxa. 🔥',
];

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(owner, date) {
  return `${STORAGE_PREFIX}${owner || 'guest'}_${date}`;
}

function readStatus(owner, date) {
  try {
    const value = localStorage.getItem(storageKey(owner, date));
    return value === 'good' || value === 'bad' ? value : null;
  } catch (_) { return null; }
}

function writeStatus(owner, date, value) {
  try { localStorage.setItem(storageKey(owner, date), value); } catch (_) {}
}

function calendarMarkerStatus(owner, key) {
  return readStatus(owner, key);
}

export default function NutritionDaily() {
  const location = useLocation();
  const owner = pb.authStore.record?.id || 'guest';
  const [now, setNow] = useState(new Date());
  const [status, setStatus] = useState(() => readStatus(owner, dateKey()));
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  const today = useMemo(() => dateKey(now), [now]);
  const due = useMemo(() => now.getHours() >= 20 && !status, [now, status]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setStatus(readStatus(owner, today));
  }, [owner, today]);

  useEffect(() => {
    if (!due) return;
    setOpen(true);
    if (permission === 'granted') {
      const notificationKey = `bt_nutrition_notified_${owner}_${today}`;
      let already = false;
      try { already = localStorage.getItem(notificationKey) === '1'; } catch (_) {}
      if (!already) {
        try { new Notification('🍽️ Com has menjat avui?', { body: 'Has menjat segons el teu pla? Marca-ho i controlem la teva ratxa.', tag: 'bt-nutrition-daily' }); } catch (_) {}
        try { localStorage.setItem(notificationKey, '1'); } catch (_) {}
      }
    }
  }, [due, permission, owner, today]);

  const save = (value) => {
    writeStatus(owner, today, value);
    setStatus(value);
    setOpen(false);
    window.dispatchEvent(new CustomEvent('bt:nutrition-updated', { detail: { date: today, status: value } }));
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch (_) {}
  };

  useEffect(() => {
    const decorateCalendar = () => {
      if (location.pathname !== '/progres') return;
      const heading = Array.from(document.querySelectorAll('h2')).find((el) => el.textContent?.trim() === 'Calendari del mes');
      const section = heading?.closest('section');
      if (!section) return;
      const grid = heading.nextElementSibling?.nextElementSibling;
      if (!grid) return;
      const buttons = Array.from(grid.querySelectorAll('button'));
      const base = new Date(now.getFullYear(), now.getMonth(), 1);
      buttons.forEach((button) => {
        const old = button.querySelector('[data-bt-nutrition-marker]');
        if (old) old.remove();
        const dayText = button.querySelector('span')?.textContent?.trim();
        const day = Number(dayText);
        if (!Number.isInteger(day) || day < 1 || day > 31) return;
        const key = dateKey(new Date(base.getFullYear(), base.getMonth(), day));
        const markerStatus = calendarMarkerStatus(owner, key);
        if (!markerStatus) return;
        button.style.position = 'relative';
        const marker = document.createElement('span');
        marker.dataset.btNutritionMarker = '1';
        marker.title = markerStatus === 'good' ? 'Nutrició correcta' : 'Nutrició a millorar';
        marker.textContent = markerStatus === 'good' ? '✓' : '×';
        marker.style.cssText = `position:absolute;right:4px;bottom:3px;width:17px;height:17px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:white;background:${markerStatus === 'good' ? '#16a34a' : '#dc2626'};box-shadow:0 1px 3px rgba(0,0,0,.18);z-index:5;`;
        button.appendChild(marker);
      });
    };

    const observer = new MutationObserver(() => window.requestAnimationFrame(decorateCalendar));
    observer.observe(document.body, { childList: true, subtree: true });
    const refresh = () => window.setTimeout(decorateCalendar, 30);
    window.addEventListener('bt:nutrition-updated', refresh);
    const initial = window.setTimeout(decorateCalendar, 80);
    return () => { observer.disconnect(); window.removeEventListener('bt:nutrition-updated', refresh); window.clearTimeout(initial); };
  }, [location.pathname, owner, now]);

  if (!pb.authStore.isValid) return null;

  return <>
    {due && !open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-24 right-4 z-50 rounded-full bg-slate-900 px-4 py-3 text-sm font-extrabold text-white shadow-xl">🍽️ Nutrició d'avui</button>}
    {open && due && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="nutrition-heading">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.18em] text-green-700">CONTROL DIARI</p><h2 id="nutrition-heading" className="mt-1 text-2xl font-extrabold">🍽️ Com has menjat avui?</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">20:00</span></div>
        <p className="mt-3 text-sm font-medium text-slate-600">Has menjat segons el teu pla i de manera correcta avui?</p>
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{MOTIVATION[now.getDate() % MOTIVATION.length]}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => save('good')} className="min-h-[64px] rounded-2xl bg-green-600 px-4 text-base font-extrabold text-white">🟢 Sí, correcte</button>
          <button type="button" onClick={() => save('bad')} className="min-h-[64px] rounded-2xl bg-red-600 px-4 text-base font-extrabold text-white">🔴 No, avui no</button>
        </div>
        {permission !== 'granted' && permission !== 'unsupported' && <button type="button" onClick={requestNotifications} className="mt-3 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">🔔 Activar notificacions</button>}
        <p className="mt-3 text-center text-xs text-slate-400">🟢 quedarà marcat com a dia correcte · 🔴 com a dia a millorar</p>
      </section>
    </div>}
  </>;
}
