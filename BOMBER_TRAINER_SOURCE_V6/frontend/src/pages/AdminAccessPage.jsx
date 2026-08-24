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

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function errorMessage(err, fallback) {
  const status = err?.status || err?.response?.status;
  if (status === 403) return 'PocketBase està bloquejant l’esborrat. A bt_access_logs posa la regla Delete: @request.auth.email = "albertdot91@gmail.com"';
  return fallback;
}

export default function AdminAccessPage() {
  const { user, isLoadingAuth } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logEmails, setLogEmails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [userRecords, accessRecords] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'name,email', perPage: 500 }),
        pb.collection('bt_access_logs').getFullList({ sort: '-date,-created', perPage: 500, expand: 'relation' }),
      ]);
      setUsers(userRecords);
      setLogs(accessRecords);

      const map = new Map(userRecords.map(account => [account.id, account]));
      const resolved = {};
      for (const log of accessRecords) {
        const id = relationId(log);
        const account = map.get(id) || log.expand?.relation;
        resolved[log.id] = log.email || account?.email || 'Compte anterior (usuari ja no disponible)';
      }
      setLogEmails(resolved);
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'No s’han pogut carregar les dades d’administració. Revisa les regles de PocketBase.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoadingAuth || user?.email !== ADMIN_EMAIL) return;
    loadData();
    const interval = window.setInterval(loadData, 5000);
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [user, isLoadingAuth]);

  const lastAccess = useMemo(() => {
    const byId = new Map();
    const byEmail = new Map();
    for (const log of logs) {
      const value = log.date || log.created;
      if (!value) continue;
      const timestamp = new Date(value).getTime();
      const id = relationId(log);
      const email = normalizedEmail(log.email || logEmails[log.id]);
      if (id) {
        const current = byId.get(id);
        if (!current || timestamp > new Date(current).getTime()) byId.set(id, value);
      }
      if (email) {
        const current = byEmail.get(email);
        if (!current || timestamp > new Date(current).getTime()) byEmail.set(email, value);
      }
    }
    return { byId, byEmail };
  }, [logs, logEmails]);

  const getLastAccess = (account) =>
    lastAccess.byId.get(account.id) || lastAccess.byEmail.get(normalizedEmail(account.email)) || null;

  const clearSessionHistory = async () => {
    if (!logs.length) return;
    if (!window.confirm(`Vols esborrar TOTS els ${logs.length} inicis de sessió? Aquesta acció no es pot desfer.`)) return;
    setDeleting(true);
    setError('');
    try {
      const records = [...logs];
      for (const record of records) {
        await pb.collection('bt_access_logs').delete(record.id);
      }
      await loadData();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'No s’ha pogut esborrar tot l’historial.'));
      await loadData();
    } finally {
      setDeleting(false);
    }
  };

  const deleteSession = async (log) => {
    if (!window.confirm('Vols esborrar aquest inici de sessió de l’historial?')) return;
    setDeletingLogId(log.id);
    setError('');
    try {
      await pb.collection('bt_access_logs').delete(log.id);
      setLogs(current => current.filter(item => item.id !== log.id));
      setLogEmails(current => {
        const next = { ...current };
        delete next[log.id];
        return next;
      });
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'No s’ha pogut esborrar aquest inici de sessió.'));
    } finally {
      setDeletingLogId('');
    }
  };

  const deleteUserSessions = async (account) => {
    const accountLogs = logs.filter(log =>
      relationId(log) === account.id ||
      normalizedEmail(log.email || logEmails[log.id]) === normalizedEmail(account.email)
    );
    if (!accountLogs.length) return;
    if (!window.confirm(`Vols esborrar els ${accountLogs.length} inicis de sessió de ${account.name || account.email}?`)) return;
    setDeletingUserId(account.id);
    setError('');
    try {
      for (const log of accountLogs) {
        await pb.collection('bt_access_logs').delete(log.id);
      }
      const ids = new Set(accountLogs.map(log => log.id));
      setLogs(current => current.filter(log => !ids.has(log.id)));
      setLogEmails(current => {
        const next = { ...current };
        accountLogs.forEach(log => delete next[log.id]);
        return next;
      });
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, 'No s’han pogut esborrar els inicis de sessió d’aquest usuari.'));
      await loadData();
    } finally {
      setDeletingUserId('');
    }
  };

  if (isLoadingAuth) return <div className="p-6">Carregant…</div>;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  const deleteAllDisabled = deleting || logs.length === 0;

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Administrador</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Activitat dels usuaris</h1>
          <p className="mt-1 text-sm text-slate-500">Només el compte administrador pot veure aquesta informació.</p>
        </div>

        {loading && <div className="rounded-2xl bg-white p-5">Carregant…</div>}
        {error && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{error}</div>}

        {!loading && !error && <>
          <div className="mb-6 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Usuaris registrats</h2>
                <p className="text-sm text-slate-500 mt-1">{users.length} usuaris</p>
              </div>
              <button type="button" onClick={clearSessionHistory} disabled={deleteAllDisabled} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {deleting ? 'Esborrant…' : '✕ Esborrar tot l’historial'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {users.length === 0 && <div className="p-5 text-sm text-slate-500">No hi ha usuaris.</div>}
              {users.map(account => {
                const accountLogs = logs.filter(log =>
                  relationId(log) === account.id ||
                  normalizedEmail(log.email || logEmails[log.id]) === normalizedEmail(account.email)
                );
                return (
                  <div key={account.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{account.name || 'Sense nom'}</div>
                      <div className="text-sm text-slate-500">{account.email}</div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-2 text-sm text-slate-600">
                      <div><span className="font-semibold text-slate-800">Registrat:</span> {formatDate(account.created)}</div>
                      <div><span className="font-semibold text-slate-800">Últim inici:</span> {formatDate(getLastAccess(account))}</div>
                      {accountLogs.length > 0 && (
                        <button type="button" onClick={() => deleteUserSessions(account)} disabled={deletingUserId === account.id || deleting} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                          {deletingUserId === account.id ? 'Esborrant…' : `✕ Esborrar ${accountLogs.length} sessions`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Historial d’inicis de sessió</h2>
                <p className="text-sm text-slate-500 mt-1">{logs.length} accessos registrats</p>
              </div>
              <button type="button" onClick={clearSessionHistory} disabled={deleteAllDisabled} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {deleting ? 'Esborrant…' : '✕ Esborrar tots els inicis'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {logs.length === 0 && <div className="p-5 text-sm text-slate-500">Encara no hi ha accessos registrats.</div>}
              {logs.map(log => {
                const id = relationId(log);
                const account = log.expand?.relation || users.find(a => a.id === id);
                const label = logEmails[log.id] || account?.email || log.email || 'Compte anterior (usuari ja no disponible)';
                return (
                  <div key={log.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{label}</div>
                      <div className="text-xs text-slate-500">inici de sessió</div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>{formatDate(log.date || log.created)}</span>
                      <button type="button" onClick={() => deleteSession(log)} disabled={deletingLogId === log.id || deleting} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
                        {deletingLogId === log.id ? 'Esborrant…' : '✕ Esborrar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>}
      </div>
    </main>
  );
}
