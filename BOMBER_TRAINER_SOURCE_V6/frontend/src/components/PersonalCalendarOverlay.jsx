import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'bomber-trainer-personal-calendar-v1';

function readCalendar() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeCalendar(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        const check = localStorage.getItem(STORAGE_KEY);
        if (check !== JSON.stringify(data)) return false;
        window.dispatchEvent(new CustomEvent('bt-personal-calendar-change'));
        return true;
    } catch {
        return false;
    }
}

function dayLabel(dateKey) {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    if (!y || !m || !d) return dateKey;
    return new Intl.DateTimeFormat('ca-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
}

function percent(values, field, validValues) {
    const answered = values.filter((v) => validValues.includes(v?.[field]));
    if (!answered.length) return 0;
    const positive = answered.filter((v) => v[field] === true || v[field] === 'good').length;
    return Math.round((positive / answered.length) * 100);
}

export default function PersonalCalendarOverlay() {
    const [calendar, setCalendar] = useState(() => readCalendar());
    const [dateKey, setDateKey] = useState(null);
    const [trained, setTrained] = useState(null);
    const [nutrition, setNutrition] = useState(null);
    const [note, setNote] = useState('');
    const [saved, setSaved] = useState(false);
    const [toast, setToast] = useState('');

    useEffect(() => {
        const onChange = () => setCalendar(readCalendar());
        window.addEventListener('storage', onChange);
        window.addEventListener('bt-personal-calendar-change', onChange);
        return () => {
            window.removeEventListener('storage', onChange);
            window.removeEventListener('bt-personal-calendar-change', onChange);
        };
    }, []);

    useEffect(() => {
        const onClick = (event) => {
            const button = event.target?.closest?.('button[aria-label*="calendari personal del dia"]');
            if (!button) return;
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
            setSaved(false);
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);

    const entries = useMemo(() => Object.values(calendar), [calendar]);
    const trainingPct = percent(entries, 'trained', [true, false]);
    const nutritionPct = percent(entries, 'nutrition', ['good', 'bad', 'out']);
    const answeredTraining = entries.filter((v) => typeof v?.trained === 'boolean').length;
    const answeredNutrition = entries.filter((v) => ['good', 'bad', 'out'].includes(v?.nutrition)).length;

    const close = () => {
        setDateKey(null);
        setSaved(false);
    };

    const showToast = (message) => {
        setToast(message);
        window.setTimeout(() => setToast(''), 1800);
    };

    const save = () => {
        if (!dateKey) return;
        const next = { ...readCalendar() };
        if (trained === null && nutrition === null && !note.trim()) {
            delete next[dateKey];
        } else {
            next[dateKey] = {
                trained,
                nutrition,
                note: note.trim(),
                updatedAt: new Date().toISOString(),
            };
        }

        const ok = writeCalendar(next);
        if (!ok) {
            setSaved(false);
            showToast('No s’ha pogut guardar. Torna-ho a provar.');
            return;
        }

        setCalendar(next);
        setSaved(true);
        showToast('✓ Dia guardat correctament');
        setDateKey(null);
    };

    const remove = () => {
        if (!dateKey) return;
        const next = { ...readCalendar() };
        delete next[dateKey];
        const ok = writeCalendar(next);
        if (!ok) {
            showToast('No s’han pogut eliminar les dades.');
            return;
        }
        setCalendar(next);
        setTrained(null);
        setNutrition(null);
        setNote('');
        showToast('✓ Dades eliminades');
        setDateKey(null);
    };

    return (
        <>
            {toast && (
                <div className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-2xl" role="status" aria-live="polite">
                    {toast}
                </div>
            )}

            {dateKey && (
                <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Calendari personal">
                    <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Calendari personal</p>
                                <h2 className="mt-1 text-xl font-extrabold capitalize">{dayLabel(dateKey)}</h2>
                            </div>
                            <button type="button" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-bold" aria-label="Tancar">×</button>
                        </div>

                        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm font-extrabold">Has entrenat aquest dia?</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setTrained(true)} className={`min-h-12 rounded-xl font-bold ${trained === true ? 'bg-green-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✓ Sí</button>
                                <button type="button" onClick={() => setTrained(false)} className={`min-h-12 rounded-xl font-bold ${trained === false ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✕ No</button>
                            </div>
                        </div>

                        <div className="mt-3 rounded-2xl bg-slate-50 p-4">
                            <p className="text-sm font-extrabold">Has menjat bé aquest dia?</p>
                            <div className="mt-3 grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setNutrition('good')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'good' ? 'bg-green-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✓ Bé</button>
                                <button type="button" onClick={() => setNutrition('out')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'out' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>🍕 Àpat fora</button>
                                <button type="button" onClick={() => setNutrition('bad')} className={`min-h-12 rounded-xl text-sm font-bold ${nutrition === 'bad' ? 'bg-red-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>✕ No</button>
                            </div>
                        </div>

                        <label className="mt-3 block rounded-2xl bg-slate-50 p-4 text-sm font-extrabold">
                            Nota del dia (opcional)
                            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex.: press banca, cansament, pizza..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none focus:ring-2 focus:ring-slate-300" />
                        </label>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button type="button" onClick={remove} className="min-h-12 rounded-xl border border-red-200 bg-red-50 font-bold text-red-700">Eliminar dades</button>
                            <button type="button" onClick={save} className="min-h-12 rounded-xl bg-slate-900 font-bold text-white">Guardar dia</button>
                        </div>

                        <div className="mt-5 border-t border-slate-100 pt-4">
                            <p className="text-sm font-extrabold">Percentatges del teu calendari</p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="rounded-2xl bg-green-50 p-3"><p className="text-[11px] font-bold uppercase text-green-700">Entrenament</p><p className="text-2xl font-extrabold text-green-700">{trainingPct}%</p><p className="text-[11px] text-slate-500">{answeredTraining} dies marcats</p></div>
                                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-[11px] font-bold uppercase text-amber-700">Alimentació</p><p className="text-2xl font-extrabold text-amber-700">{nutritionPct}%</p><p className="text-[11px] text-slate-500">{answeredNutrition} dies marcats</p></div>
                            </div>
                            <p className="mt-2 text-[11px] text-slate-400">El percentatge només compta els dies que has marcat; els dies buits no et penalitzen.</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
