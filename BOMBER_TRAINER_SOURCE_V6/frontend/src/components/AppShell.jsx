import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Bot, UserRound } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

const NAV = [
    { to: '/', label: 'Avui', Icon: Home },
    { to: '/progres', label: 'Progrés', Icon: LineChart },
    { to: '/ia', label: 'IA', Icon: Bot },
    { to: '/perfil', label: 'Perfil', Icon: UserRound, profile: true },
];

function getProfile() {
    const record = pb.authStore.record || {};
    const fullName = String(record.name || record.fullName || record.full_name || record.username || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`
        : parts[0]?.slice(0, 2) || String(record.email || '?').slice(0, 2);
    return { initials: initials.toUpperCase(), name: fullName || record.email || 'Perfil' };
}

export default function AppShell({ title, children }) {
    const { pathname } = useLocation();
    const profile = getProfile();

    return (
        <div className="min-h-[100dvh] bg-slate-50 text-slate-900 pb-24">
            <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200 bg-slate-900">
                        <img src="/bomber-icon-exact.svg?v=12" alt="BOMBER TRAINER" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold tracking-widest text-slate-400">BOMBER TRAINER</p>
                        <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">{children}</main>
            <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200">
                <div className="mx-auto max-w-3xl grid grid-cols-4">
                    {NAV.map(({ to, label, Icon, profile: isProfile }) => {
                        const active = pathname === to;
                        return (
                            <Link key={to} to={to} aria-label={isProfile ? `Perfil de ${profile.name}` : label} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                                {isProfile ? (
                                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-extrabold ${active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'}`}>
                                        {profile.initials}
                                    </span>
                                ) : <Icon className="h-5 w-5" strokeWidth={2} />}
                                {label}
                            </Link>
                    );
                    })}
                </div>
            </nav>
        </div>
    );
}
