import React, { useEffect, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { MATERIAL, TYPES } from '@/lib/btData';
import { parseSuuntoFit } from '@/suuntoFit';
import { getIntervalsApiKey, setIntervalsApiKey, testIntervalsConnection, syncRecentIntervalsActivities } from '@/intervalsIcu';

function resolveIntervalsType(activity, selectedType) {
    if (selectedType !== 'auto') return selectedType;
    const text = `${activity?.type || ''} ${activity?.name || ''}`.toLowerCase();
    if (text.includes('swim') || text.includes('pool') || text.includes('nat')) return 'aquatic';
    if (text.includes('strength') || text.includes('weight') || text.includes('press')) return 'pressbanca';
    if (text.includes('run') || text.includes('trail') || text.includes('forest')) return 'forestal';
    return null;
}

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [material, setMaterial] = useState([]);
    const [settingsId, setSettingsId] = useState(null);
    const [status, setStatus] = useState('');
    const [suuntoType, setSuuntoType] = useState('forestal');
    const [suuntoBusy, setSuuntoBusy] = useState(false);
    const [suuntoMetrics, setSuuntoMetrics] = useState(null);
    const [intervalsKey, setIntervalsKey] = useState(getIntervalsApiKey());
    const [intervalsType, setIntervalsType] = useState('auto');
    const [intervalsBusy, setIntervalsBusy] = useState(false);
    const [intervalsConnected, setIntervalsConnected] = useState(false);
    const [intervalsStatus, setIntervalsStatus] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        pb.collection('bt_settings').getFullList().then((rows) => {
            if (rows[0]) { setSettingsId(rows[0].id); setMaterial(rows[0].material || []); }
        }).catch(() => {});
    }, []);

    const toggle = async (name) => {
        const next = material.includes(name) ? material.filter((x) => x !== name) : [...material, name];
        setMaterial(next);
        try {
            if (settingsId) await pb.collection('bt_settings').update(settingsId, { material: next });
            else { const rec = await pb.collection('bt_settings').create({ material: next, owner: pb.authStore.record.id }); setSettingsId(rec.id); }
        } catch { /* es tornarà a intentar al següent canvi */ }
    };

    const importSuunto = async (event) => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        setSuuntoBusy(true); setStatus('Llegint activitat del Suunto…');
        try {
            const metrics = await parseSuuntoFit(file); setSuuntoMetrics(metrics);
            const rows = await pb.collection('bt_sessions').getFullList({ sort: '-date' });
            const matching = rows.find((row) => row.date === metrics.date && row.type === suuntoType);
            const wearable = { ...(matching?.wearable || {}), suunto: metrics };
            if (matching) { await pb.collection('bt_sessions').update(matching.id, { wearable }); setStatus(`Suunto importat i associat a la sessió ${metrics.date}.`); }
            else { await pb.collection('bt_sessions').create({ type: suuntoType, date: metrics.date, duration: Math.round((metrics.durationSeconds / 60) * 10) / 10, points: 0, notes: 'Activitat importada del Suunto', data: [], wearable, owner: pb.authStore.record.id }); setStatus(`Suunto importat com a nova sessió de ${metrics.date}.`); }
        } catch (error) { setStatus(error?.message || 'No s’ha pogut llegir el FIT del Suunto.'); } finally { setSuuntoBusy(false); }
    };

    const connectIntervals = async () => {
        if (!intervalsKey.trim()) { setIntervalsStatus('Enganxa primer la teva clau API personal d’Intervals.icu.'); return; }
        setIntervalsBusy(true); setIntervalsStatus('Comprovant connexió…');
        try { setIntervalsApiKey(intervalsKey); const account = await testIntervalsConnection(); setIntervalsConnected(true); setIntervalsStatus(`Connectat: ${account.name || 'compte Intervals.icu'}.`); }
        catch (error) { setIntervalsConnected(false); setIntervalsStatus(error?.message || 'No s’ha pogut connectar amb Intervals.icu.'); }
        finally { setIntervalsBusy(false); }
    };

    const syncIntervals = async () => {
        if (!intervalsConnected) { setIntervalsStatus('Connecta Intervals.icu abans de sincronitzar.'); return; }
        setIntervalsBusy(true); setIntervalsStatus('Sincronitzant entrenaments dels últims 30 dies…');
        try {
            const result = await syncRecentIntervalsActivities({ pb, owner: pb.authStore.record.id, days: 30, typeResolver: (activity) => resolveIntervalsType(activity, intervalsType) });
            setIntervalsStatus(`Sincronització acabada: ${result.imported} activitat(s) importada(es) de ${result.total} trobada(es).`);
        } catch (error) { setIntervalsStatus(error?.message || 'No s’ha pogut sincronitzar Intervals.icu.'); }
        finally { setIntervalsBusy(false); }
    };

    return (
        <AppShell title="Configuració">
            <Helmet><title>Configuració — BOMBER TRAINER</title><meta name="description" content="Material disponible, perfil, Suunto i sincronització d'entrenaments." /></Helmet>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">📡 Intervals.icu</h2>
                <p className="mt-1 text-sm text-slate-500">Connecta el teu compte d’Intervals.icu i importa els entrenaments que ja han arribat del Suunto. La clau es guarda només al navegador.</p>
                <div className="mt-4 grid gap-3">
                    <input value={intervalsKey} onChange={(e) => setIntervalsKey(e.target.value)} type="password" autoComplete="off" placeholder="Clau API personal d’Intervals.icu" className="min-h-[48px] rounded-xl border border-slate-300 px-3" />
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={connectIntervals} disabled={intervalsBusy} className="min-h-[48px] rounded-xl bg-slate-900 px-4 font-bold text-white disabled:opacity-50">{intervalsBusy ? 'Connectant…' : '🔗 Connectar i comprovar'}</button>
                        <button type="button" onClick={syncIntervals} disabled={intervalsBusy || !intervalsConnected} className="min-h-[48px] rounded-xl border border-slate-300 px-4 font-bold disabled:opacity-50">↻ Sincronitzar últims 30 dies</button>
                    </div>
                    <label className="grid gap-1 text-sm font-semibold">Associació automàtica de les activitats
                        <select value={intervalsType} onChange={(e) => setIntervalsType(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3 font-normal">
                            <option value="auto">Automàtica (córrer → forestal · natació → aquàtica · força → press banca)</option>
                            <option value="forestal">Forçar com a forestal</option>
                            <option value="aquatic">Forçar com a aquàtica</option>
                            <option value="estructural">Forçar com a estructural</option>
                            <option value="pressbanca">Forçar com a press banca</option>
                        </select>
                    </label>
                </div>
                {intervalsStatus && <p className={`mt-3 text-sm font-semibold ${intervalsConnected ? 'text-green-700' : 'text-slate-600'}`}>{intervalsStatus}</p>}
                <p className="mt-3 text-xs text-slate-400">Intervals.icu ofereix API personal per accedir a les teves pròpies dades. En una fase posterior podem passar a OAuth perquè la connexió sigui amb un botó i sense enganxar cap clau.</p>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">⌚ Suunto</h2>
                <p className="mt-1 text-sm text-slate-500">Importa un FIT exportat del teu Suunto i afegeix les dades disponibles a l’entrenament.</p>
                <div className="mt-4 grid gap-3">
                    <label className="grid gap-1 text-sm font-semibold">Prova a associar<select value={suuntoType} onChange={(e) => setSuuntoType(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3">{Object.values(TYPES).filter((t) => !['descans', 'manteniment', 'rapid'].includes(t.key)).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
                    <label className={`min-h-[56px] rounded-2xl bg-slate-900 px-4 flex items-center justify-center font-bold text-white cursor-pointer ${suuntoBusy ? 'opacity-60 pointer-events-none' : ''}`}>{suuntoBusy ? 'Llegint Suunto…' : '⌚ Importar activitat FIT'}<input type="file" accept=".fit,application/octet-stream" onChange={importSuunto} className="sr-only" disabled={suuntoBusy} /></label>
                </div>
                {suuntoMetrics && <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">FC mitjana</span><strong className="block text-lg">{suuntoMetrics.heartRate.average ?? '—'}{suuntoMetrics.heartRate.average ? ' bpm' : ''}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">FC màxima</span><strong className="block text-lg">{suuntoMetrics.heartRate.max ?? '—'}{suuntoMetrics.heartRate.max ? ' bpm' : ''}</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Durada</span><strong className="block text-lg">{Math.round(suuntoMetrics.durationSeconds / 60)} min</strong></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Distància</span><strong className="block text-lg">{suuntoMetrics.distanceKm ?? '—'}{suuntoMetrics.distanceKm !== null ? ' km' : ''}</strong></div></div>}
                {status && <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p>}
                <p className="mt-3 text-xs text-slate-400">També pots continuar important un FIT manualment si alguna activitat no apareix a Intervals.icu.</p>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Material disponible</h2><div className="mt-3 flex flex-wrap gap-2">{MATERIAL.map((name) => <button key={name} type="button" onClick={() => toggle(name)} className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${material.includes(name) ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{name}</button>)}</div></section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-extrabold">Perfil</h2><p className="mt-1 text-sm text-slate-500">{user?.email}</p><button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="mt-4 min-h-[48px] w-full rounded-xl border border-slate-300 font-semibold text-slate-600">Tancar sessió</button></section>
        </AppShell>
    );
}
