import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import pb from '@/lib/pocketbaseClient';

const ADMIN_EMAIL = 'albertdot91@gmail.com';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ca-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

function relationId(log) {
  if (typeof log?.relation === 'string') return log.relation;
  return log?.relation?.id || '';
}

async function resolveEmail(log, userById) {
  if (log?.email) return log.email;
  if (typeof log?.action === 'string' && log.action.startsWith('login|')) return log.action.slice(6);
  const id = relationId(log);
  if (!id) return 'Compte anterior (usuari ja no disponible)';
  const local = userById.get(id);
  if (local?.email) return local.email;
  try {
    const account = await pb.collection('users').getOne(id, { fields: 'id,email,name' });
    if (account?.email) return account.email;
  } catch (e) {
    console.warn('Could not resolve access-log user', id, e);
  }
  return 'Compte anterior (usuari ja no disponible)';
}

export default function AdminAccessPage() {
  const { user, isLoadingAuth } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logEmails, setLogEmails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRecords, accessRecords] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'name,email', perPage: 500 }),
        pb.collection('bt_access_logs').getFullList({ sort: '-date', perPage: 500, expand: 'relation' }),
      ]);
      setUsers(userRecords);
      setLogs(accessRecords);
      const map = new Map(userRecords.map(account => [account.id, account]));
      const resolved = {};
      await Promise.all(accessRecords.map(async log => { resolved[log.id] = await resolveEmail(log, map); }));
      setLogEmails(resolved);
    } catch (err) {
      console.error(err);
      setError('No s’han pogut carregar les dades d’administració. Revisa les regles de PocketBase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoadingAuth || user?.email !== ADMIN_EMAIL) return;
    loadData();
  }, [user, isLoadingAuth]);

  const lastAccessByUserId = useMemo(() => {
    const result = new Map();
    for (const log of logs) {
      const id = relationId(log);
      if (id && !result.has(id)) result.set(id, log.date);
    }
    return result;
  }, [logs]);

  const clearSessionHistory = async () => {
    if (!window.confirm('Vols esborrar TOT l’historial d’inicis de sessió? Aquesta acció no es pot desfer.')) return;
    setDeleting(true);
    setError('');
    try {
      const records = await pb.collection('bt_access_logs').getFullList({ perPage: 500 });
      await Promise.all(records.map(record => pb.collection('bt_access_logs').delete(record.id)));
      await loadData();
    } catch (err) {
      console.error(err);
      setError('No s’ha pogut esborrar tot l’historial. Comprova la regla Delete de bt_access_logs.');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoadingAuth) return <div className="p-6">Carregant…</div>;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Administrador</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Activitat dels usuaris</h1>
          <p className="mt-1 text-sm text-slate-500">Només el compte administrador pot veure aquesta informació.</p>
        </div>

        {loading && <div className="rounded-2xl bg-white p-5">Carregant…</div>}
        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{error}</div>}

        {!loading && !error && <>
          <div className="mb-6 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div><h2 className="font-bold text-slate-900">Usuaris registrats</h2><p className="text-sm text-slate-500 mt-1">{users.length} usuaris</p></div>
              <button type="button" onClick={clearSessionHistory} disabled={deleting || logs.length === 0} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{deleting ? 'Esborrant…' : '✕ Esborrar historial de sessions'}</button>
            </div>
            <div className="divide-y divide-slate-100">
              {users.length === 0 && <div className="p-5 text-sm text-slate-500">No hi ha usuaris.</div>}
              {users.map(account => <div key={account.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><div className="font-semibold text-slate-900">{account.name || 'Sense nom'}</div><div className="text-sm text-slate-500">{account.email}</div></div><div className="text-sm text-slate-600 sm:text-right"><div><span className="font-semibold text-slate-800">Registrat:</span> {formatDate(account.created)}</div><div><span className="font-semibold text-slate-800">Últim inici:</span> {formatDate(lastAccessByUserId.get(account.id))}</div></div></div>)}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-900">Historial d’inicis de sessió</h2><p className="text-sm text-slate-500 mt-1">{logs.length} accessos registrats</p></div>
            <div className="divide-y divide-slate-100">
              {logs.length === 0 && <div className="p-5 text-sm text-slate-500">Encara no hi ha accessos registrats.</div>}
              {logs.map(log => {
                const id = relationId(log);
                const account = log.expand?.relation || users.find(a => a.id === id);
                const label = logEmails[log.id] || account?.email || log.email || 'Carregant correu…';
                return <div key={log.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"><div><div className="font-semibold text-slate-900">{label}</div><div className="text-xs text-slate-500">inici de sessió</div></div><div className="text-sm text-slate-500">{formatDate(log.date)}</div></div>;
              })}
            </div>
          </div>
        </>}
      </div>
    </main>
  );
}
