import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import pb from '@/lib/pocketbaseClient';
import AppShell from '@/components/AppShell';

const ADMIN_EMAIL = 'albertdot91@gmail.com';

export default function AdminUsersProgressPage() {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const isAdmin = String(pb.authStore.record?.email || '').toLowerCase() === ADMIN_EMAIL;

  const load = async () => {
    if (!isAdmin) return;
    try {
      setError('');
      const [u, s] = await Promise.all([
        pb.collection('users').getFullList({ sort: 'email' }),
        pb.collection('bt_sessions').getFullList({ sort: '-date' }),
      ]);
      setUsers(u);
      setSessions(s);
      if (!selected && u.length) setSelected(u[0].id);
    } catch (e) {
      setError(e?.response?.message || e?.message || 'No s’han pogut carregar les dades.');
    }
  };

  useEffect(() => { load(); }, []);

  const userSessions = useMemo(() => sessions.filter((s) => s.owner === selected), [sessions, selected]);
  const chart = useMemo(() => userSessions.slice().reverse().map((s, i) => ({
    label: String(s.date || '').slice(5, 10) || `#${i + 1}`,
    points: Number(s.points) || 0,
    duration: Number(s.duration) || 0,
  })).slice(-20), [userSessions]);
  const selectedUser = users.find((u) => u.id === selected);

  if (!isAdmin) return <AppShell><div className="p-6">Accés no autoritzat.</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold">👁️ Activitat dels usuaris</h1><p className="text-sm text-slate-500">Vista exclusiva d’administrador. Les dades no es barregen amb el teu progrés.</p></div>
          <Link to="/progres" className="rounded-xl border px-4 py-2 text-sm font-semibold">← Progrés</Link>
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="rounded-2xl border bg-white p-4">
          <label className="mb-2 block text-sm font-semibold">Usuari</label>
          <select className="w-full rounded-xl border p-3" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email || u.name || u.id}</option>)}
          </select>
        </div>
        {selectedUser && <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Compte</div><div className="font-semibold break-all">{selectedUser.email}</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Sessions</div><div className="text-2xl font-bold">{userSessions.length}</div></div>
          <div className="rounded-2xl border bg-white p-4"><div className="text-xs text-slate-500">Última activitat</div><div className="font-semibold">{userSessions[0] ? String(userSessions[0].date || '').slice(0, 16).replace('T', ' ') : '—'}</div></div>
        </div>}
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Evolució de sessions</h2>
          {chart.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="duration" name="Temps (s)" strokeWidth={2}/><Line type="monotone" dataKey="points" name="Punts" strokeWidth={2}/></LineChart></ResponsiveContainer></div> : <div className="py-12 text-center text-slate-500">Aquest usuari encara no té sessions registrades.</div>}
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-bold">Calendari d’activitat</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">{Array.from({ length: 31 }, (_, i) => { const day = String(i + 1).padStart(2, '0'); const active = userSessions.some((s) => String(s.date || '').slice(8, 10) === day); return <div key={day} className={`rounded-lg p-2 ${active ? 'bg-emerald-100 font-bold text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</div>; })}</div>
        </div>
        <button onClick={load} className="rounded-xl border px-4 py-2 text-sm font-semibold">↻ Actualitzar dades</button>
      </div>
    </AppShell>
  );
}
