import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LineChart, Bot, Settings } from 'lucide-react';

const NAV = [
    { to: '/', label: 'Avui', Icon: Home },
    { to: '/progres', label: 'Progrés', Icon: LineChart },
    { to: '/ia', label: 'IA', Icon: Bot },
    { to: '/configuracio', label: 'Config', Icon: Settings },
];

export default function AppShell({ title, children }) {
    const { pathname } = useLocation();

    return (
        <div className="min-h-[100dvh] bg-slate-50 text-slate-900 pb-24">
            <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
                <div className="mx-auto max-w-3xl px-4 py-4">
                    <p className="text-xs font-bold tracking-widest text-slate-400">BOMBER TRAINER</p>
                    <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">{children}</main>
            <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200">
                <div className="mx-auto max-w-3xl grid grid-cols-4">
                    {NAV.map(({ to, label, Icon }) => {
                        const active = pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}
                            >
                                <Icon className="h-5 w-5" strokeWidth={2} />
                                {label}
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
