import React, { useEffect, useState } from 'react';
import Helmet from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/contexts/AuthContext';
import { MATERIAL, levelFor, streak, totalPoints } from '@/lib/btData';
import { buildHandoffZip, buildSourceZip, download } from '@/lib/btExport';

export default function SettingsPage() {
    const { user, logout } = useAuth();
    const [material, setMaterial] = useState([]);
    const [settingsId, setSettingsId] = useState(null);
    const [status, setStatus] = useState('');
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
                <meta name="description" content="Material disponible, perfil i exportació del codi font i de l'estat del projecte." />
            </Helmet>

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
                        <button
                            key={name}
                            type="button"
                            onClick={() => toggle(name)}
                            className={`min-h-[44px] rounded-xl px-4 text-sm font-semibold ${material.includes(name) ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </section>

            <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                <h2 className="text-lg font-extrabold">Perfil</h2>
                <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
                <button
                    type="button"
                    onClick={() => { logout(); navigate('/login', { replace: true }); }}
                    className="mt-4 min-h-[48px] w-full rounded-xl border border-slate-300 font-semibold text-slate-600"
                >
                    Tancar sessió
                </button>
            </section>
        </AppShell>
    );
}
