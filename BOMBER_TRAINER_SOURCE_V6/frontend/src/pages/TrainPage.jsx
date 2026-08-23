import React, { useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import StructuralExerciseGraphic from '@/components/StructuralExerciseGraphic';
import { INCIDENTS, PLANS, POINTS, TYPES, formatTime, gradeForBench, gradeForTime, parseTime, today } from '@/lib/btData';

const MAINTENANCE_MINUTES = [5, 10, 15, 20];
const MAINTENANCE_SERIES = 4;
const TIME_FIELDS = new Set(['temps', 'tram1', 'tram2', 'tram3']);
const FIELD_LABELS = { pes: 'Pes (kg)', pesLlast: 'Pes llast (kg)', reps: 'Repeticions', series: 'Sèries', temps: 'Temps (min)', descans: 'Descans (s)', tram1: 'Tram 1 (min)', tram2: 'Tram 2 (min)', tram3: 'Tram 3 (min)' };

const parseTrainingTime = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) return parseTime(text);
    if (/^\d+\s*,\s*\d{1,2}$/.test(text)) {
        const [minutes, seconds] = text.split(',').map((part) => Number(part.trim()));
        if (Number.isFinite(minutes) && Number.isFinite(seconds) && seconds >= 0 && seconds < 60) return minutes * 60 + seconds;
    }
    return parseTime(value);
};

const structuralGraphicKind = (name) => {
    if (/Discos/i.test(name)) return 'discos';
    if (/Kettlebells/i.test(name)) return 'kettlebells';
    if (/Trineu/i.test(name)) return 'trineu';
    if (/Recorregut en C/i.test(name)) return 'c';
    if (/Maniqu/i.test(name)) return 'maniqui';
    if (/Esprint/i.test(name)) return 'sprint';
    return null;
};

export default function TrainPage() {
    const { type } = useParams();
    const [searchParams] = useSearchParams();
    const t = TYPES[type] || TYPES.manteniment;
    const plan = PLANS[t.key] || [];
    const isMaintenance = t.key === 'manteniment';
    const isForestal = t.key === 'forestal';
    const isStructural = t.key === 'estructural';
    const isAquatic = t.key === 'aquatic';
    const isPressBench = t.key === 'pressbanca';
    const selectedDate = searchParams.get('date');
    const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate : today();
    const initialDuration = isMaintenance ? (searchParams.get('durada') || '5') : '';
    const maintenancePlan = isMaintenance ? [...plan.filter((p) => !/gambad/i.test(p.name)), { name: 'Slam ball', detail: 'Llançaments al terra · registra repeticions per sèrie.' }, { name: 'Pujada i baixada de caixa (step-up)', detail: 'Pujar i baixar la caixa de fusta · registra repeticions per sèrie.' }] : plan;
    const activePlan = isMaintenance ? maintenancePlan : plan;
    const [duration, setDuration] = useState(initialDuration);
    const [entries, setEntries] = useState(() => activePlan.map(() => isMaintenance ? { series: Array(MAINTENANCE_SERIES).fill('') } : {}));
    const [exerciseNames, setExerciseNames] = useState(() => activePlan.map((p) => p.name));
    const [maintenanceWeights, setMaintenanceWeights] = useState(() => activePlan.map(() => ''));
    const [incidents, setIncidents] = useState([]); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const navigate = useNavigate();
    const setField = (i, field, value) => setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
    const setMaintenanceSeries = (exerciseIndex, seriesIndex, value) => setEntries((prev) => prev.map((entry, index) => { if (index !== exerciseIndex) return entry; const series = Array.isArray(entry.series) ? [...entry.series] : Array(MAINTENANCE_SERIES).fill(''); series[seriesIndex] = value; return { ...entry, series }; }));
    const selectMaintenanceMinutes = (minutes) => { setDuration(String(minutes)); };
    const setExerciseName = (i, value) => setExerciseNames((prev) => prev.map((n, j) => j === i ? value : n));
    const setMaintenanceWeight = (i, value) => setMaintenanceWeights((prev) => prev.map((w, j) => j === i ? value : w));
    const toggleIncident = (name) => setIncidents((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
    const forestalTrams = useMemo(() => isForestal ? entries.slice(0, 3).map((entry) => parseTrainingTime(entry?.temps)) : [0, 0, 0], [entries, isForestal]);
    const forestalCompletedTrams = forestalTrams.filter((seconds) => seconds > 0).length;
    const forestalTotalSeconds = useMemo(() => forestalTrams.reduce((sum, seconds) => sum + seconds, 0), [forestalTrams]);
    // Rendiment orientatiu de cada tram: repartim el barem provisional de 3:00 segons la càrrega de treball 8/10/12 + slam balls 16/20/24 (4:5:6). No és la nota oficial de la prova.
    const forestalTramTargets = [48, 60, 72];
    const forestalTramPercentages = forestalTrams.map((seconds, index) => seconds > 0 ? Math.min(100, Math.round((forestalTramTargets[index] / seconds) * 100)) : null);
    const structuralTotalSeconds = useMemo(() => isStructural ? entries.reduce((sum, entry) => sum + parseTrainingTime(entry?.temps), 0) : 0, [entries, isStructural]);
    const aquaticTotalSeconds = useMemo(() => isAquatic ? entries.reduce((sum, entry) => sum + parseTrainingTime(entry?.temps), 0) : 0, [entries, isAquatic]);
    const pressBenchSeconds = isPressBench ? Number(entries[0]?.temps) || 0 : 0;
    const pressBenchGrade = useMemo(() => {
        if (!isPressBench) return null;
        const weight = Number(entries[0]?.pes) || 0;
        const reps = Number(entries[0]?.reps) || 0;
        if (weight <= 0 || reps <= 0 || pressBenchSeconds <= 0) return null;
        return gradeForBench(weight, reps, pressBenchSeconds);
    }, [entries, isPressBench, pressBenchSeconds]);
    const forestalComplete = isForestal && forestalCompletedTrams === 3;
    const structuralComplete = isStructural && entries.every((entry) => parseTrainingTime(entry?.temps) > 0);
    const aquaticComplete = isAquatic && entries.every((entry) => parseTrainingTime(entry?.temps) > 0);
    const forestalGrade = forestalComplete ? gradeForTime('forestal', forestalTotalSeconds) : null;
    const structuralGrade = structuralComplete ? gradeForTime('estructural', structuralTotalSeconds) : null;
    const aquaticGrade = aquaticComplete ? gradeForTime('aquatic', aquaticTotalSeconds) : null;
    const save = async (kind) => {
        setBusy(true); setError('');
        try {
            if (isForestal && kind === 'complet' && !forestalComplete) {
                setError('La prova forestal no està completa: falta almenys un tram. Guarda-la com a prova parcial.');
                return;
            }
            const points = kind === 'complet' ? POINTS.complet : kind === 'manteniment' ? POINTS.manteniment : POINTS.minim;
            const data = activePlan.map((p, i) => {
                if (!isMaintenance) {
                    if (isForestal && p.name === 'CIRCUIT COMPLET') return {
                        exercici: p.name,
                        temps: forestalTotalSeconds,
                        tram1: forestalTrams[0],
                        tram2: forestalTrams[1],
                        tram3: forestalTrams[2],
                        tram1Percentatge: forestalTramPercentages[0],
                        tram2Percentatge: forestalTramPercentages[1],
                        tram3Percentatge: forestalTramPercentages[2],
                        tramsCompletats: forestalCompletedTrams,
                        estat: forestalComplete ? 'complet' : 'parcial',
                        tram3Estat: forestalTrams[2] > 0 ? 'completat' : 'no completat',
                    };
                    return Object.fromEntries(Object.entries({ exercici: p.name, ...entries[i] }).map(([key, value]) => [key, isPressBench && key === 'temps' ? (Number(value) || 0) : (TIME_FIELDS.has(key) ? parseTrainingTime(value) : value)]));
                }
                return { exercici: exerciseNames[i].trim() || p.name, llastKg: String(maintenanceWeights[i] ?? '').trim(), series: (entries[i]?.series || []).slice(0, MAINTENANCE_SERIES).map((v) => String(v ?? '').trim()) };
            });
            if (isMaintenance && !data.some((e) => e.series.some((v) => v !== ''))) { setError('Registra almenys una sèrie abans de guardar.'); return; }
            const computedMinutes = isPressBench && pressBenchSeconds > 0
                ? pressBenchSeconds / 60
                : isForestal
                    ? forestalTotalSeconds / 60
                    : isStructural && structuralTotalSeconds > 0
                        ? structuralTotalSeconds / 60
                        : isAquatic && aquaticTotalSeconds > 0
                            ? aquaticTotalSeconds / 60
                            : Number(duration) || 0;
            const finalNotes = isForestal && !forestalComplete
                ? `${notes ? `${notes} ` : ''}Prova forestal parcial: ${forestalCompletedTrams}/3 trams completats. Tram 3 no completat per cansament.`
                : notes;
            await pb.collection('bt_sessions').create({ type: t.key, date: sessionDate, duration: computedMinutes, points: t.key === 'descans' ? 0 : points, incidents: incidents.join(', '), notes: finalNotes, data, owner: pb.authStore.record.id });
            navigate('/progres');
        } catch (err) { setError(err?.message || 'No s\'ha pogut guardar la sessió.'); } finally { setBusy(false); }
    };
    return <AppShell title={t.label}>
        <Helmet><title>{`${t.label} — BOMBER TRAINER`}</title></Helmet>
        {selectedDate && <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Estàs registrant l'entrenament del <strong>{sessionDate}</strong>. La sessió quedarà guardada en aquest dia.</div>}
        <div className="rounded-3xl p-5" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}><p className="text-xs font-bold tracking-widest" style={{ color: t.color }}>{t.short}</p><p className="mt-1 text-sm font-medium text-slate-700">{isMaintenance ? 'Manteniment flexible. Tria la durada i registra tu mateix què has fet.' : 'Registra el que has fet.'}</p></div>
        {isMaintenance && <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><p className="text-xs font-bold tracking-widest text-slate-400">TEMPS DISPONIBLE</p><h2 className="mt-1 text-lg font-extrabold">Tria la durada</h2><div className="mt-3 grid grid-cols-4 gap-2">{MAINTENANCE_MINUTES.map((minutes) => <button key={minutes} type="button" onClick={() => selectMaintenanceMinutes(minutes)} className={`min-h-[56px] rounded-2xl px-2 text-sm font-extrabold ${Number(duration) === minutes ? 'bg-yellow-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>{minutes} MIN</button>)}</div><p className="mt-3 text-sm text-slate-500">La durada i el nombre de sèries són independents. Sempre tens 4 opcions de sèrie.</p></section>}
        {isForestal && <div className="rounded-2xl bg-orange-50 p-4 text-sm font-bold text-orange-800">Trams forestal: <strong>{forestalCompletedTrams}/3 completats</strong>{!forestalComplete && forestalCompletedTrams > 0 ? ' · Pots guardar la prova parcial sense inventar el tram que falta.' : ''}</div>}
        <section className="space-y-3">{activePlan.map((p, i) => <div key={`${p.name}-${i}`} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">{isMaintenance ? <><label className="grid gap-1 text-sm font-semibold">Exercici<input type="text" value={exerciseNames[i] ?? p.name} onChange={(e) => setExerciseName(i, e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 font-extrabold" /></label><p className="mt-2 text-sm text-slate-500">{p.detail}</p><label className="mt-3 grid gap-1 text-sm font-semibold">Pes llast (kg) <span className="text-xs font-normal text-slate-400">Opcional</span><input type="number" min="0" step="0.5" placeholder="Sense llast" value={maintenanceWeights[i] ?? ''} onChange={(e) => setMaintenanceWeight(i, e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /></label><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: MAINTENANCE_SERIES }, (_, s) => <label key={s} className="grid gap-1 text-xs font-bold text-slate-500">Sèrie {s + 1}<input type="text" inputMode="numeric" value={entries[i]?.series?.[s] ?? ''} onChange={(e) => setMaintenanceSeries(i, s, e.target.value)} className="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-base font-extrabold" /></label>)}</div></> : isForestal && p.name === 'CIRCUIT COMPLET' ? <><p className="font-extrabold">{p.name}</p><p className="text-sm text-slate-500">Els 3 trams seguits. El temps total es calcula automàticament.</p><div className="mt-3 rounded-2xl bg-orange-50 p-4"><p className="text-xs font-bold">TEMPS TOTAL</p><p className="mt-1 text-2xl font-extrabold">{formatTime(forestalTotalSeconds)}</p><p className="mt-1 text-sm font-extrabold text-orange-700">{forestalCompletedTrams}/3 trams completats{forestalComplete ? ' · prova completa' : ' · prova parcial'}</p>{forestalGrade !== null && <p className="mt-1 text-sm font-extrabold text-orange-700">Nota {forestalGrade}/10 · {Math.round(forestalGrade * 10)}%</p>}</div></> : <><p className="font-extrabold">{p.name}</p><p className="text-sm text-slate-500">{p.detail}</p>{isStructural && <StructuralExerciseGraphic kind={structuralGraphicKind(p.name)} />}<div className="mt-3 grid grid-cols-2 gap-3">{p.fields.map((f) => <label key={f} className="grid gap-1 text-sm font-semibold">{isPressBench && f === 'temps' ? 'Temps de la prova (s)' : (FIELD_LABELS[f] || f)}<input type={isPressBench && f === 'temps' ? 'number' : (TIME_FIELDS.has(f) ? 'text' : 'number')} inputMode="decimal" value={entries[i]?.[f] ?? ''} onChange={(e) => setField(i, f, e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /></label>)}</div>{isForestal && i < 3 && <div className="mt-3 rounded-2xl bg-orange-50 p-3"><p className="text-xs font-bold tracking-widest text-orange-600">RENDIMENT DEL TRAM</p><p className="mt-1 text-lg font-extrabold text-slate-900">{forestalTramPercentages[i] !== null ? `${forestalTramPercentages[i]}%` : 'Introdueix el temps'}</p><p className="mt-1 text-xs text-slate-600">Referència provisional segons el temps i la càrrega relativa del tram. No és la nota oficial.</p></div>}{isPressBench && <div className="mt-4 rounded-2xl bg-violet-50 p-4"><p className="text-xs font-bold tracking-widest text-violet-600">BAREM PRESS BANCA</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{pressBenchGrade !== null ? `${pressBenchGrade}/10 · ${Math.round(pressBenchGrade * 10)}%` : 'Introdueix pes, repeticions i temps'}</p><p className="mt-1 text-xs text-slate-600">10/10 = 65 kg · 20 repeticions · ≤45 segons</p></div>}{isStructural && i === activePlan.length - 1 && <div className="mt-4 rounded-2xl bg-red-50 p-4"><p className="text-xs font-bold tracking-widest text-red-600">BAREM ESTRUCTURAL</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{structuralGrade !== null ? `${structuralGrade}/10 · ${Math.round(structuralGrade * 10)}%` : 'Completa els 6 exercicis de la ruta per calcular la nota'}</p><p className="mt-1 text-xs text-slate-600">Nota segons el temps total de la ruta.</p></div>}{isAquatic && i === activePlan.length - 1 && <div className="mt-4 rounded-2xl bg-sky-50 p-4"><p className="text-xs font-bold tracking-widest text-sky-600">BAREM AQUÀTICA</p><p className="mt-1 text-2xl font-extrabold text-slate-900">{aquaticGrade !== null ? `${aquaticGrade}/10 · ${Math.round(aquaticGrade * 10)}%` : 'Completa els temps de la prova per calcular la nota'}</p><p className="mt-1 text-xs text-slate-600">Nota segons el temps total de la prova.</p></div>}</>}</div>)}</section>
        <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">{isMaintenance ? <p className="text-sm font-semibold">Durada seleccionada: <strong>{duration} min</strong></p> : isForestal ? <p className="text-sm font-semibold">Durada total: <strong>{formatTime(forestalTotalSeconds)}</strong></p> : isStructural ? <p className="text-sm font-semibold">Temps total calculat: <strong>{formatTime(structuralTotalSeconds)}</strong></p> : isAquatic ? <p className="text-sm font-semibold">Temps total calculat: <strong>{formatTime(aquaticTotalSeconds)}</strong></p> : isPressBench ? <p className="text-sm font-semibold">Temps de la prova: <strong>{formatTime(pressBenchSeconds)}</strong></p> : <label className="grid gap-1 text-sm font-semibold">Durada total (min)<input type="number" step="0.1" value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /></label>}<div><p className="text-sm font-semibold">Incidències</p><div className="mt-2 flex flex-wrap gap-2">{INCIDENTS.map((name) => <button key={name} type="button" onClick={() => toggleIncident(name)} className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${incidents.includes(name) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{name}</button>)}</div></div><label className="grid gap-1 text-sm font-semibold">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl border border-slate-300 p-3" /></label>{error && <p className="text-sm text-red-600">{error}</p>}<div className="grid gap-2 sm:grid-cols-3">{!isMaintenance && <button type="button" disabled={busy || (isForestal && !forestalComplete)} onClick={() => save('complet')} className="min-h-[52px] rounded-xl bg-slate-900 font-bold text-white disabled:opacity-40">{isForestal && !forestalComplete ? 'Complet +100 (bloquejat)' : 'Complet +100'}</button>}{isForestal && !forestalComplete && <button type="button" disabled={busy || forestalCompletedTrams === 0} onClick={() => save('minim')} className="min-h-[52px] rounded-xl bg-orange-100 font-bold text-orange-900 disabled:opacity-40">Guardar prova parcial +20</button>}<button type="button" disabled={busy} onClick={() => save('manteniment')} className="min-h-[52px] rounded-xl bg-yellow-400 font-bold text-slate-900">{isMaintenance ? 'Guardar manteniment +40' : 'Manteniment +40'}</button><button type="button" disabled={busy} onClick={() => save('minim')} className="min-h-[52px] rounded-xl bg-slate-100 font-bold text-slate-700">{isMaintenance ? 'Guardar mínim +20' : 'Mínim +20'}</button></div></section>
    </AppShell>;
}