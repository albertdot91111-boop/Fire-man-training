import React, { useEffect, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { MATERIAL, TYPES, levelFor, streak, totalPoints } from '@/lib/btData';
import { buildHandoffZip, buildSourceZip, download } from '@/lib/btExport';
import { parseSuuntoFit } from '@/suuntoFit';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [material, setMaterial] = useState([]);
    const [settingsId, setSettingsId] = useState(null);
    const [status, setStatus] = useState('');
    const [suuntoType, setSuuntoType] = useState('forestal');
    const [suuntoBusy, setSuuntoBusy] = useState(false);
    const [suuntoMetrics, setSuuntoMetrics] = useState(null);
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
            else {
                const rec = await pb.collection('bt_settings').create({ material: next, owner: pb.authStore.record.id });
                setSettingsId(rec.id);
            }
        } catch { /* es tornarà a intentar al següent canvi */ }
    };

    const importSuunto = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setSuuntoBusy(true);
        setStatus('Llegint activitat del Suunto…');
        try {
            const metrics = await parseSuuntoFit(file);
            setSuuntoMetrics(metrics);
            const rows = await pb.collection('bt_sessions').getFullList({ sort: '-date' });
            const matching = rows.find((row) => row.date === metrics.date && row.type === suuntoType);
            const wearable = { ...(matching?.wearable || {}), suunto: metrics };
            if (matching) {
                await pb.collection('bt_sessions').update(matching.id, { wearable });
                setStatus(`Suunto importat i associat a la sessió ${metrics.date}.`);
            } else {
                await pb.collection('bt_sessions').create({
                    type: suuntoType,
                    date: metrics.date,
                    duration: Math.round((metrics.durationSeconds / 60) * 10) / 10,
                    points: 0,
                    notes: 'Activitat importada del Suunto',
                    data: [],
                    wearable,
                    owner: pb.authStore.record.id,
                });
                setStatus(`Suunto importat com a nova sessió de ${metrics.date}.`);
            }
        } catch (error) {
            setStatus(error?.message || 'No s’ha pogut llegir el FIT del Suunto.');
        } finally {
            setSuuntoBusy(false);
        }
    };

    const exportSource = () => {
        setStatus('Generant BOMBER_TRAINER_SOURCE.zip…');
        download(buildSourceZip(), 'BOMBER_TRAINER_SOURCE.zip');
        setStatus('BOMBER_TRAINER_SOURCE.zip descarregat (sense claus ni secrets).');
    };

    const exportHandoff = async () => {
        setStatus('Generant BOMBER_TRAINER_HANDOFF.zip…');
        const [sessions, weights, goals] = await Promise.all([
            pb.collection('bt_sessions').getFullList({ sort: '-date' }).catch(() => []),
            pb.collection('bt_weights').getFullList({ sort: '-date' }).catch(() => []),
            pb.collection('bt_goals').getFullList().catch(() => []),
        ]);
        const points = totalPoints(sessions);
        download(buildHandoffZip({
            sessions, weights, goals, material, points,
            level: levelFor(points).name, streakDays: streak(sessions),
        }), 'BOMBER_TRAINER_HANDOFF.zip');
        setStatus('BOMBER_TRAINER_HANDOFF.zip descarregat.');
    };

    return (
        <AppShell title="Configuració">
            <Helmet>
                <title>Configuració — BOMBER TRAINER</title>
                <meta name="description" content="Material disponible, perfil, Suunto i exportació del projecte." />
            </Helmet>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">⌚ Suunto</h2>
                <p className="mt-1 text-sm text-slate-500">Importa un FIT exportat del teu Suunto i afegeix freqüència cardíaca i durada a l'entrenament.</p>
                <div className="mt-4 grid gap-3">
                    <label className="grid gap-1 text-sm font-semibold">
                        Prova a associar
                        <select value={suuntoType} onChange={(e) => setSuuntoType(e.target.value)} className="min-h-[48px] rounded-xl border border-slate-300 px-3">
                            {Object.values(TYPES).filter((t) => !['descans', 'manteniment', 'rapid'].includes(t.key)).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                    </label>
                    <label className={`min-h-[56px] rounded-2xl bg-slate-900 px-4 flex items-center justify-center font-bold text-white cursor-pointer ${suuntoBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                        {suuntoBusy ? 'Llegint Suunto…' : '⌚ Importar activitat FIT'}
                        <input type="file" accept=".fit,application/octet-stream" onChange={importSuunto} className="sr-only" disabled={suuntoBusy} />
                    </label>
                </div>
                {suuntoMetrics && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">FC mitjana</span><strong className="block text-lg">{suuntoMetrics.heartRate.average} bpm</strong></div>
                        <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">FC màxima</span><strong className="block text-lg">{suuntoMetrics.heartRate.max} bpm</strong></div>
                        <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Durada</span><strong className="block text-lg">{Math.round(suuntoMetrics.durationSeconds / 60)} min</strong></div>
                        <div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500">Mostres FC</span><strong className="block text-lg">{suuntoMetrics.heartRate.samples}</strong></div>
                    </div>
                )}
                <p className="mt-3 text-xs text-slate-400">Aquesta primera versió usa FIT del Suunto. La sincronització automàtica amb Suunto Connect requereix accés/API del compte i la farem en una segona fase.</p>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Desenvolupament</h2>
                <p className="mt-1 text-sm text-slate-500">Exportacions per traspassar el projecte entre IAs sense perdre res.</p>
                <div className="mt-4 grid gap-3">
                    <button type="button" onClick={exportSource} className="min-h-[56px] rounded-2xl bg-slate-900 font-bold text-white active:scale-[0.98]">1. Exportar codi font (ZIP)</button>
                    <button type="button" onClick={exportHandoff} className="min-h-[56px] rounded-2xl bg-purple-700 font-bold text-white active:scale-[0.98]">2. Exportar estat del projecte (ZIP)</button>
                </div>
                {status && <p className="mt-3 text-sm font-semibold text-slate-600">{status}</p>}
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Material disponible</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                    {MATERIAL.map((name) => (
                        <button key={name} type="button" onClick={() => toggle(name)} className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${material.includes(name) ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{name}</button>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Perfil</h2>
                <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
                <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }); }} className="mt-4 min-h-[48px] w-full rounded-xl border border-slate-300 font-semibold text-slate-600">Tancar sessió</button>
            </section>
        </AppShell>
    );
}
