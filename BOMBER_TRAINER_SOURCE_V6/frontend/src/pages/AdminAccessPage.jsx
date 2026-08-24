import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import pb from '@/lib/pocketbaseClient';

const ADMIN_EMAIL = 'albertdot91@gmail.com';

export default function AdminAccessPage() {
  const { user, isLoadingAuth } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoadingAuth || user?.email !== ADMIN_EMAIL) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const records = await pb.collection('bt_access_logs').getFullList({
          sort: '-accessedAt',
          perPage: 200,
        });
        if (!cancelled) setLogs(records);
      } catch (err) {
        if (!cancelled) {
          setError('No s’han pogut carregar els accessos. La col·lecció d’accessos encara pot no estar activada al servidor.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, isLoadingAuth]);

  if (isLoadingAuth) return <div className="p-6">Carregant…</div>;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Administrador</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Accessos al Bomber Trainer</h1>
          <p className="mt-1 text-sm text-slate-500">Només el compte fundador pot veure aquest registre.</p>
        </div>

        {loading && <div className="rounded-2xl bg-white p-5">Carregant accessos…</div>}
        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{error}</div>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200">
            <div className="border-b border-slate-200 px-5 py-4 font-bold">{logs.length} accessos registrats</div>
            <div className="divide-y divide-slate-100">
              {logs.length === 0 && <div className="p-5 text-sm text-slate-500">Encara no hi ha accessos registrats.</div>}
              {logs.map((log) => (
                <div key={log.id} className="px-5 py-4">
                  <div className="font-semibold text-slate-900">{log.email}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {new Date(log.accessedAt).toLocaleString('ca-ES', {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
