import React, { useMemo, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { INCIDENTS, PLANS, POINTS, TYPES, formatTime, parseTime, today } from '@/lib/btData';

const MAINTENANCE_MINUTES = [5, 10, 15];
const TIME_FIELDS = new Set(['temps', 'tram1', 'tram2', 'tram3']);
const maintenanceSeriesCount = (minutes) => ({ 5: 1, 10: 2, 15: 3 }[minutes] || 2);

const FIELD_LABELS = {
    pes: 'Pes (kg)',
    reps: 'Repeticions',
    series: 'Sèries',
    temps: 'Temps (min)',
    descans: 'Descans (s)',
    tram1: 'Tram 1 (min)',
    tram2: 'Tram 2 (min)',
    tram3: 'Tram 3 (min)',
};

export default function TrainPage() {
    const { type } = useParams();
    const t = TYPES[type] || TYPES.manteniment;
    const plan = PLANS[t.key] || [];
    const isMaintenance = t.key === 'manteniment';
    const isForestal = t.key === 'forestal';
    const [duration, setDuration] = useState(() => (isMaintenance ? '10' : ''));
    const [entries, setEntries] = useState(() => plan.map(() => (isMaintenance ? { series: ['', ''] } : {})));
    const [exerciseNames, setExerciseNames] = useState(() => plan.map((p) => p.name));
    const [incidents, setIncidents] = useState([]);
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const setField = (i, field, value) => setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
    const setMaintenanceSeries = (exerciseIndex, seriesIndex, value) => setEntries((prev) => prev.map((entry, index) => {
        if (index !== exerciseIndex) return entry;
        const series = Array.isArray(entry.series) ? [...entry.series] : [];
        series[seriesIndex] = value;
        return { ...entry, series };
    }));
    const selectMaintenanceMinutes = (minutes) => {
        const count = maintenanceSeriesCount(minutes);
        setDuration(String(minutes));
        setEntries((prev) => plan.map((p, index) => {
            const existing = Array.isArray(prev[index]?.series) ? prev[index].series : [];
            return { ...prev[index], series: Array.from({ length: count }, (_, seriesIndex) => existing[seriesIndex] ?? '') };
        }));
    };
    const setExerciseName = (index, value) => setExerciseNames((prev) => prev.map((name, nameIndex) => (nameIndex === index ? value : name)));
    const toggleIncident = (name) => setIncidents((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

    const forestalTotalSeconds = useMemo(() => {
        if (!isForestal) return 0;
        return entries.slice(0, 3).reduce((sum, entry) => sum + parseTime(entry?.temps), 0);
    }, [entries, isForestal]);

    const save = async (kind) => {
        setBusy(true);
        setError('');
        try {
            const points = kind === 'complet' ? POINTS.complet : kind === 'manteniment' ? POINTS.manteniment : POINTS.minim;
            const seriesCount = maintenanceSeriesCount(Number(duration));
            const data = plan.map((p, i) => {
                if (!isMaintenance) {
                    if (isForestal && p.name === 'CIRCUIT COMPLET') {
                        return {
                            exercici: p.name,
                            temps: forestalTotalSeconds,
                            tram1: parseTime(entries[0]?.temps),
                            tram2: parseTime(entries[1]?.temps),
                            tram3: parseTime(entries[2]?.temps),
                        };
                    }
                    return Object.fromEntries(Object.entries({ exercici: p.name, ...entries[i] }).map(([key, value]) => [
                        key,
                        TIME_FIELDS.has(key) ? parseTime(value) : value,
                    ]));
                }
                return {
                    exercici: exerciseNames[i].trim() || p.name,
                    series: (Array.isArray(entries[i]?.series) ? entries[i].series : []).slice(0, seriesCount).map((value) => String(value ?? '').trim()),
                };
            });
            if (isMaintenance && !data.some((entry) => entry.series.some((value) => value !== ''))) {
                setError('Registra almenys una sèrie abans de guardar.');
                return;
            }
            await pb.collection('bt_sessions').create({
                type: t.key,
                date: today(),
                duration: isForestal ? forestalTotalSeconds / 60 : Number(duration) || 0,
                points: t.key === 'descans' ? 0 : points,
                incidents: incidents.join(', '),
                notes,
                data,
                owner: pb.authStore.record.id,
            });
            navigate('/progres');
        } catch (err) {
            setError(err?.message || 'No s\'ha pogut guardar la sessió.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell title={t.label}>
            <Helmet>
                <title>{`${t.label} — BOMBER TRAINER`}</title>
                <meta name="description" content={`Registra el teu entrenament de ${t.label.toLowerCase()}: sèries, pesos, temps i descansos.`} />
            </Helmet>

            <div className="rounded-3xl p-5" style={{ backgroundColor: t.soft, borderLeft: `8px solid ${t.color}` }}>
                <p className="text-xs font-bold tracking-widest" style={{ color: t.color }}>{t.short}</p>
                <p className="mt-1 text-sm font-medium text-slate-700">Registra el que has fet. Els camps de temps accepten minuts decimals (3.5) o min:seg (3:30).</p>
            </div>

            {isMaintenance && (
                <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs font-bold tracking-widest text-slate-400">TEMPS DISPONIBLE</p>
                    <h2 className="mt-1 text-lg font-extrabold">Tria la durada</h2>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {MAINTENANCE_MINUTES.map((minutes) => (
                            <button
                                key={minutes}
                                type="button"
                                data-testid={`maintenance-duration-${minutes}`}
                                onClick={() => selectMaintenanceMinutes(minutes)}
                                className={`min-h-[56px] rounded-2xl px-2 text-sm font-extrabold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${Number(duration) === minutes ? 'bg-yellow-400 text-slate-900 shadow-sm' : 'bg-slate-100 text-slate-700'}`}
                            >
                                ⚡ {minutes} MIN
                            </button>
                        ))}
                    </div>
                    <p className="mt-3 text-sm text-slate-500">{maintenanceSeriesCount(Number(duration))} {maintenanceSeriesCount(Number(duration)) === 1 ? 'sèrie' : 'sèries'} per exercici. Pots canviar el nom i cada quantitat.</p>
                </section>
            )}

            <section className="space-y-3">
                {plan.map((p, i) => (
                    <div key={p.name} className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
                        {isMaintenance ? (
                            <>
                                <label className="grid gap-1 text-sm font-semibold">
                                    Exercici
                                    <input type="text" value={exerciseNames[i] ?? p.name} onChange={(e) => setExerciseName(i, e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 font-extrabold" />
                                </label>
                                <p className="mt-2 text-sm text-slate-500">{p.detail}</p>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    {Array.from({ length: maintenanceSeriesCount(Number(duration)) }, (_, seriesIndex) => (
                                        <label key={seriesIndex} className="grid gap-1 text-xs font-bold text-slate-500">
                                            Sèrie {seriesIndex + 1}
                                            <input type="number" min="0" inputMode="numeric" data-testid={`maintenance-series-${i + 1}-${seriesIndex + 1}`} value={entries[i]?.series?.[seriesIndex] ?? ''} onChange={(e) => setMaintenanceSeries(i, seriesIndex, e.target.value)} className="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-base font-extrabold text-slate-900" />
                                        </label>
                                    ))}
                                </div>
                            </>
                        ) : isForestal && p.name === 'CIRCUIT COMPLET' ? (
                            <>
                                <p className="font-extrabold">{p.name}</p>
                                <p className="text-sm text-slate-500">Els 3 trams seguits. El temps total es calcula automàticament.</p>
                                <div className="mt-3 rounded-2xl bg-orange-50 border border-orange-100 p-4">
                                    <p className="text-xs font-bold text-orange-700">TEMPS TOTAL</p>
                                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{formatTime(forestalTotalSeconds)}</p>
                                    <p className="mt-1 text-xs text-slate-500">Tram 1 + Tram 2 + Tram 3</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="font-extrabold">{p.name}</p>
                                <p className="text-sm text-slate-500">{p.detail}</p>
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    {p.fields.map((f) => (
                                        <label key={f} className="grid gap-1 text-sm font-semibold capitalize">
                                            {FIELD_LABELS[f] || f}
                                            <input type={TIME_FIELDS.has(f) ? 'text' : 'number'} inputMode="decimal" placeholder={TIME_FIELDS.has(f) ? 'ex. 3.5 o 3:30' : undefined} data-testid={`train-field-${i}-${f}`} value={entries[i]?.[f] ?? ''} onChange={(e) => setField(i, f, e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" />
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
                {isMaintenance ? (
                    <p className="text-sm font-semibold">Durada seleccionada: <strong>{duration} min</strong></p>
                ) : isForestal ? (
                    <p className="text-sm font-semibold">Durada total: <strong>{formatTime(forestalTotalSeconds)}</strong></p>
                ) : (
                    <label className="grid gap-1 text-sm font-semibold">Durada total (min)<input type="number" step="0.1" value={duration} onChange={(e) => setDuration(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3" /></label>
                )}
                <div>
                    <p className="text-sm font-semibold">Incidències</p>
                    <div className="mt-2 flex flex-wrap gap-2">{INCIDENTS.map((name) => <button key={name} type="button" onClick={() => toggleIncident(name)} className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${incidents.includes(name) ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{name}</button>)}</div>
                </div>
                <label className="grid gap-1 text-sm font-semibold">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-xl border border-slate-300 p-3" /></label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="grid gap-2 sm:grid-cols-3">
                    {!isMaintenance && <button type="button" data-testid="train-save-complet" disabled={busy} onClick={() => save('complet')} className="min-h-[52px] rounded-xl bg-slate-900 font-bold text-white active:scale-[0.98]">Complet +100</button>}
                    <button type="button" data-testid="train-save-manteniment" disabled={busy} onClick={() => save('manteniment')} className="min-h-[52px] rounded-xl bg-yellow-400 font-bold text-slate-900 active:scale-[0.98]">{isMaintenance ? 'Guardar manteniment +40' : 'Manteniment +40'}</button>
                    <button type="button" data-testid="train-save-minim" disabled={busy} onClick={() => save('minim')} className="min-h-[52px] rounded-xl bg-slate-100 font-bold text-slate-700 active:scale-[0.98]">{isMaintenance ? 'Guardar mínim +20' : 'Mínim +20'}</button>
                </div>
                <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await pb.collection('bt_sessions').create({ type: 'descans', date: today(), points: 0, notes: 'Dia no disponible', owner: pb.authStore.record.id }); navigate('/'); } catch (err) { setError(err?.message || 'Error'); } finally { setBusy(false); } }} className="w-full min-h-[48px] rounded-xl border border-slate-300 font-semibold text-slate-600">Marcar avui com a dia no disponible</button>
            </section>
        </AppShell>
    );
}
