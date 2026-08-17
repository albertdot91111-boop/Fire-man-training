import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { buildSourceZip, buildHandoffZip, download } from '@/lib/btExport';

export default function DownloadPage() {
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState('');

    const exportSource = () => {
        setBusy('source');
        setStatus('Generant BOMBER_TRAINER_SOURCE.zip…');
        try {
            download(buildSourceZip(), 'BOMBER_TRAINER_SOURCE.zip');
            setStatus('BOMBER_TRAINER_SOURCE.zip descarregat.');
        } catch {
            setStatus('No s\'ha pogut generar el ZIP del codi font.');
        } finally {
            setBusy('');
        }
    };

    const exportHandoff = () => {
        setBusy('handoff');
        setStatus('Generant BOMBER_TRAINER_HANDOFF.zip…');
        try {
            download(buildHandoffZip(), 'BOMBER_TRAINER_HANDOFF.zip');
            setStatus('BOMBER_TRAINER_HANDOFF.zip descarregat.');
        } catch {
            setStatus('No s\'ha pogut generar el ZIP de traspàs.');
        } finally {
            setBusy('');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="sticky top-0 z-10 bg-slate-900 text-white">
                <div className="mx-auto max-w-md px-4 py-4 flex items-center justify-between">
                    <span className="text-lg font-extrabold tracking-tight">BOMBER TRAINER</span>
                    <Link to="/login" className="text-sm font-semibold text-slate-300">Iniciar sessió</Link>
                </div>
            </header>

            <main className="mx-auto w-full max-w-md px-4 py-6 flex-1">
                <h1 className="text-2xl font-extrabold text-slate-900">Descàrrega del projecte</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Exporta el codi font i la documentació de traspàs perquè un altre agent o desenvolupador pugui continuar el projecte seguint el mateix patró. No cal iniciar sessió.
                </p>

                <section className="mt-5 rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                    <h2 className="text-lg font-extrabold">1. Codi font (ZIP)</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Tot el frontend, la configuració de reconstrucció (Vite, Tailwind, PostCSS), el lockfile i els docs. Sense claus ni secrets.
                    </p>
                    <button
                        type="button"
                        onClick={exportSource}
                        disabled={busy !== ''}
                        className="mt-4 min-h-[56px] w-full rounded-2xl bg-slate-900 font-bold text-white active:scale-[0.98] disabled:opacity-60"
                    >
                        {busy === 'source' ? 'Generant…' : 'Descarregar codi font'}
                    </button>
                </section>

                <section className="mt-4 rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
                    <h2 className="text-lg font-extrabold">2. Traspàs (ZIP)</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Idea general, què està fet, què falta i el patró a seguir per al següent agent (HANDOFF.md + documents de context, funcionalitats, base de dades i IA).
                    </p>
                    <button
                        type="button"
                        onClick={exportHandoff}
                        disabled={busy !== ''}
                        className="mt-4 min-h-[56px] w-full rounded-2xl bg-purple-700 font-bold text-white active:scale-[0.98] disabled:opacity-60"
                    >
                        {busy === 'handoff' ? 'Generant…' : 'Descarregar traspàs'}
                    </button>
                </section>

                {status && <p className="mt-4 text-sm font-semibold text-slate-600">{status}</p>}
            </main>
        </div>
    );
}