import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';

const LEGACY_STORAGE_KEY = 'bomber-trainer-personal-calendar-v1';
const STORAGE_PREFIX = 'bomber-trainer-personal-calendar-v1-user-';
const WORKOUTS = [
    ['pressbanca', 'Press banca', '💪'],
    ['estructural', 'Incendi estructural', '🚒'],
    ['forestal', 'Incendi forestal', '🌲'],
    ['aquatic', 'Prova aquàtica', '🏊'],
    ['manteniment', 'Manteniment', '🔧'],
    ['rapid', 'Entrenament ràpid', '⚡'],
];

function ownerId() {
    return pb.authStore.record?.id || '';
}

function storageKey() {
    const id = ownerId();
    return id ? `${STORAGE_PREFIX}${id}` : null;
}

function readCalendar() {
    try {
        const key = storageKey();
        if (!key) return {};
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeCalendar(data) {
    try {
        const key = storageKey();
        if (!key) return false;
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);
        if (localStorage.getItem(key) !== serialized) return false;
        window.dispatchEvent(new CustomEvent('bt-personal-calendar-change'));
        window.dispatchEvent(new CustomEvent('bt:nutrition-updated'));
        window.dispatchEvent(new CustomEvent('bt:progress-updated'));
        return true;
    } catch { return false; }
}

function writeNutritionCompatibility(dateKey, nutrition) {
    try {
        const owner = ownerId();
        if (!owner) return;
        const key = `bt_nutrition_${owner}_${dateKey}`;
        if (['good', 'bad', 'free_meal', 'out'].includes(nutrition)) localStorage.setItem(key, nutrition === 'out' ? 'free_meal' : nutrition);
        else localStorage.removeItem(key);
    } catch { /* calendar remains authoritative */ }
}

function dayLabel(dateKey) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    return new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function nextDateKey(dateKey) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    const next = new Date(y, m - 1, d + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function percent(values, field, validValues) {
    const answered = values.filter((v) => validValues.includes(v?.[field]));
    if (!answered.length) return 0;
    const positive = answered.filter((v) => v[field] === true || v[field] === 'good').length;
    return Math.round((positive / answered.length) * 100);
}

function sessionLabel(session) {
    const labels = { pressbanca: 'Press banca', estructural: 'Incendi estructural', forestal: 'Incendi forestal', aquatic: 'Prova aquàtica', manteniment: 'Manteniment', rapid: 'Entrenament ràpid', descans: 'Dia no disponible' };
    return labels[session?.type] || session?.type || 'Sessió';
}

function formatDuration(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return 'Sessió registrada';
    const total = Math.round(minutes * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function sessionMetrics(session) {
    const wearable = session?.wearable && typeof session.wearable === 'object' ? session.wearable : null;
    if (!wearable) return null;
    const seconds = Number(wearable.durationSeconds) > 0 ? Number(wearable.durationSeconds) : null;
    const distance = Number(wearable.distanceKm) > 0 ? Number(wearable.distanceKm) : (Number(wearable.distanceMeters) > 0 ? Number(wearable.distanceMeters) / 1000 : null);
    const avg = Number(wearable?.heartRate?.average) > 0 ? Number(wearable.heartRate.average) : null;
    if (!seconds && !distance && !avg) return null;
    const paceSeconds = seconds && distance ? seconds / distance : null;
    const pace = paceSeconds ? `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/km` : null;
    return {
        duration: seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : null,
        distance: distance ? `${distance.toFixed(2)} km` : null,
        pace,
        heart: avg ? `${Math.round(avg)} bpm` : null,
    };
}

export default function PersonalCalendarOverlay() {
    const navigate = useNavigate();
    const [calendar, setCalendar] = useState(() => readCalendar());
    const [dateKey, setDateKey] = useState(null);
    const [trained, setTrained] = useState(null);
    const [nutrition, setNutrition] = useState(null);
    const [note, setNote] = useState('');
    const [toast, setToast] = useState('');
    const [daySessions, setDaySessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        const refresh = () => setCalendar(readCalendar());
        const authChange = () => { setDateKey(null); setCalendar(readCalendar()); };
        window.addEventListener('storage', refresh);
        window.addEventListener('bt-personal-calendar-change', refresh);
        window.addEventListener('bt:progress-updated', refresh);
        pb.authStore.onChange(authChange);
        return () => {
            window.removeEventListener('storage', refresh);
            window.removeEventListener('bt-personal-calendar-change', refresh);
            window.removeEventListener('bt:progress-updated', refresh);
        };
    }, []);

    useEffect(() => {
        const onClick = async (event) => {
            const button = event.target?.closest?.('button[aria-label*="calendari personal del dia"]');
            if (!button || !ownerId()) return;
            const match = button.getAttribute('aria-label')?.match(/dia\s+(\d+)/i);
            if (!match) return;
            const day = Number(match[1]);
            const now = new Date();
            const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const current = readCalendar();
            const entry = current[key] || {};
            setCalendar(current);
            setDateKey(key);
            setTrained(typeof entry.trained === 'boolean' ? entry.trained : null);
            setNutrition(entry.nutrition ?? null);
            setNote(entry.note ?? '');
            setDaySessions([]);
            setLoadingSessions(true);
            try {
                const nextKey = nextDateKey(key);
                const records = await pb.collection('bt_sessions').getFullList({
                    filter: `owner = "${ownerId()}" && ((date = "${key}") || (date >= "${key} 00:00:00" && date < "${nextKey} 00:00:00"))`,
                    sort: '-created',
                });
                setDaySessions(records);
            } catch {
                setDaySessions([]);
            } finally {
                setLoadingSessions(false);
            }
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);

    const entries = useMemo(() => Object.values(calendar), [calendar]);
    const trainingPct = percent(entries, 'trained', [true, false]);
    const nutritionPct = percent(entries, 'nutrition', ['good', 'bad', 'out']);
    const answeredTraining = entries.filter((v) => typeof v?.trained === 'boolean').length;
    const answeredNutrition = entries.filter((v) => ['good', 'bad', 'out'].includes(v?.nutrition)).length;

    const close = () => setDateKey(null);
    const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 1800); };

    const save = () => {
        if (!dateKey || !ownerId()) return;
        const next = { ...readCalendar() };
        if (trained === null && nutrition === null && !note.trim()) delete next[dateKey];
        else next[dateKey] = { trained, nutrition, note: note.trim(), updatedAt: new Date().toISOString() };
        writeNutritionCompatibility(dateKey, nutrition);
        if (!writeCalendar(next)) { showToast('No s’ha pogut guardar.'); return; }
        setCalendar(next);
        showToast('✓ Dia guardat correctament');
        setDateKey(null);
    };

    const remove = () => {
        if (!dateKey || !ownerId()) return;
        const next = { ...readCalendar() };
        delete next[dateKey];
        writeNutritionCompatibility(dateKey, null);
        if (!writeCalendar(next)) { showToast('No s’han pogut eliminar les dades.'); return; }
        setCalendar(next);
        showToast('✓ Dades eliminades');
        setDateKey(null);
    };

    const deleteSession = async (session) => {
        if (!session?.id || deletingId) return;
        if (!window.confirm(`Eliminar ${sessionLabel(session)} del ${String(session.date || '').slice(0, 10)}?`)) return;
        setDeletingId(session.id);
        try {
            await pb.collection('bt_sessions').delete(session.id);
            setDaySessions((current) => current.filter((item) => item.id !== session.id));
            window.dispatchEvent(new CustomEvent('bt:progress-updated'));
            showToast('✓ Sessió eliminada');
        } catch (err) {
            showToast(err?.response?.message || 'No s’ha pogut eliminar la sessió.');
        } finally { setDeletingId(null); }
    };

    const chooseWorkout = (type) => {
        if (!dateKey) return;
        const current = readCalendar();
        const next = { ...current, [dateKey]: { ...(current[dateKey] || {}), trained: true, nutrition, note: note.trim(), updatedAt: new Date().toISOString() } };
        writeCalendar(next);
        setCalendar(next);
        setTrained(true);
        navigate(`/entrena/${type}?date=${encodeURIComponent(dateKey)}`);
    };

    return <>
        {toast && <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-2xl" role="status">{toast}</div>}
        {dateKey && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Calendari personal">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Calendari personal</p><h2 className="mt-1 text-xl font-extrabold capitalize">{dayLabel(dateKey)}</h2></div><button type="button" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold">×</button></div>
                <div className="mt-5 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-extrabold">Has entrenat aquest dia?</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setTrained(true)} className={`min-h-12 rounded-xl font-bold ${trained === true ? 'bg-green-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✓ Sí</button><button type="button" onClick={() => setTrained(false)} className={`min-h-12 rounded-xl font-bold ${trained === false ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✕ No</button></div>{trained === true && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3"><p className="text-xs font-extrabold uppercase tracking-wide text-green-800">Quin entrenament?</p><div className="mt-2 grid grid-cols-2 gap-2">{WORKOUTS.map(([type, label, emoji]) => <button key={type} type="button" onClick={() => chooseWorkout(type)} className="min-h-11 rounded-xl bg-white px-3 text-left text-xs font-bold text-slate-800 ring-1 ring-green-100">{emoji} {label}</button>)}</div><button type="button" onClick={() => navigate(`/entrena/rapid?date=${encodeURIComponent(dateKey)}`)} className="mt-2 w-full rounded-xl bg-slate-900 py-3 text-sm font-extrabold text-white">Obrir formulari d'entrenament complet</button></div>}</div>
                <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-sm font-extrabold">Has menjat bé aquest dia?</p><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => setNutrition('good')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'good' ? 'bg-green-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✓ Bé</button><button type="button" onClick={() => setNutrition('out')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'out' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>🍕 Àpat fora</button><button type="button" onClick={() => setNutrition('bad')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'bad' ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✕ No</button></div></div>
                <label className="mt-3 block rounded-2xl bg-slate-50 p-4 text-sm font-extrabold">Nota del dia (opcional)<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex.: press banca, cansament, pizza..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none" /></label>
                <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={remove} className="min-h-12 rounded-xl border border-red-200 bg-red-50 font-bold text-red-700">Eliminar dades</button><button type="button" onClick={save} className="min-h-12 rounded-xl bg-slate-900 font-bold text-white">✓ Guardar dia</button></div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-sm font-extrabold">Entrenaments registrats aquest dia</p><span className="text-xs font-bold text-slate-400">{daySessions.length}</span></div>{loadingSessions ? <p className="mt-3 text-xs text-slate-400">Carregant…</p> : daySessions.length === 0 ? <p className="mt-3 text-xs text-slate-400">No hi ha cap sessió registrada.</p> : <div className="mt-3 space-y-2">{daySessions.map((session) => { const m = sessionMetrics(session); return <div key={session.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-bold">{sessionLabel(session)}</p><p className="text-[11px] text-slate-500">{m ? [m.duration, m.distance, m.pace, m.heart].filter(Boolean).join(' · ') : formatDuration(session.duration)}{session.points ? ` · +${session.points} punts` : ''}</p></div><button type="button" disabled={deletingId === session.id} onClick={() => deleteSession(session)} className="min-h-10 rounded-lg bg-white px-3 text-xs font-extrabold text-red-600 shadow-sm">Eliminar</button></div>; })}</div>}</div>
                <div className="mt-5 border-t border-slate-100 pt-4"><p className="text-sm font-extrabold">Percentatges del teu calendari</p><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-green-50 p-3"><p className="text-[11px] font-bold uppercase text-green-700">Entrenament</p><p className="text-2xl font-extrabold text-green-700">{trainingPct}%</p><p className="text-[11px] text-slate-500">{answeredTraining} dies marcats</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-[11px] font-bold uppercase text-amber-700">Alimentació</p><p className="text-2xl font-extrabold text-amber-700">{nutritionPct}%</p><p className="text-[11px] text-slate-500">{answeredNutrition} dies marcats</p></div></div><p className="mt-2 text-[11px] text-slate-400">El percentatge només compta els dies que has marcat; els dies buits no et penalitzen.</p></div>
            </div>
        </div>}
    </>;
}
