import React, { useState, useEffect } from 'react';
import Helmet from 'react-helmet';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { beginGoogleLogin } from '@/lib/googleOAuth';
import GoogleIcon from '@/components/GoogleIcon';

export default function LoginPage() {
    const { login, isAuthed } = useAuth();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthed) navigate('/', { replace: true });
    }, [isAuthed, navigate]);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            if (mode === 'login') await login(email, password);
            else { navigate('/register'); return; }
            navigate('/', { replace: true });
        } catch (err) {
            setError(err?.message || 'No s\'ha pogut completar l\'acció.');
        } finally {
            setBusy(false);
        }
    };

    const google = async () => {
        setError('');
        try {
            await beginGoogleLogin('/');
        } catch (err) {
            setError(err?.message || 'Google no està disponible ara mateix.');
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4" data-testid="login-page">
            <Helmet>
                <title>Accés — BOMBER TRAINER</title>
                <meta name="description" content="Accedeix al teu perfil d'opositor de Bombers i sincronitza els teus entrenaments." />
            </Helmet>
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
                <p className="text-xs font-bold tracking-widest text-slate-400">BOMBER TRAINER</p>
                <h1 className="mt-1 text-2xl font-extrabold">{mode === 'login' ? 'Entra' : 'Crea el teu perfil'}</h1>
                <p className="mt-2 text-sm text-slate-500">Les teves dades es sincronitzen al servidor i les tens a qualsevol dispositiu.</p>
                <form onSubmit={submit} className="mt-5 space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-semibold" htmlFor="email">Correu</label>
                        <input id="email" data-testid="login-email-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-semibold" htmlFor="password">Contrasenya</label>
                        <input id="password" data-testid="login-password-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" />
                    </div>
                    {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
                    <button type="submit" data-testid="login-submit-button" disabled={busy} className="w-full min-h-[52px] rounded-xl bg-slate-900 text-white font-bold active:scale-[0.98] transition disabled:opacity-60">
                        {busy ? 'Un moment…' : mode === 'login' ? 'Entrar' : 'Crear perfil'}
                    </button>
                </form>

                <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-slate-400">o</span></div>
                </div>
                <button type="button" data-testid="login-google-button" onClick={google} className="w-full min-h-[52px] rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 flex items-center justify-center gap-2 active:scale-[0.98] transition">
                    <GoogleIcon className="w-5 h-5" />
                    Continua amb Google
                </button>

                <button type="button" data-testid="login-toggle-mode" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="mt-4 w-full text-sm font-semibold text-slate-500">
                    {mode === 'login' ? 'No tens compte? Crea\'n un' : 'Ja tens compte? Entra'}
                </button>
                <Link to="/descarrega" data-testid="login-download-link" className="mt-4 block w-full text-center text-sm font-semibold text-purple-700">
                    Descarregar codi font i traspàs del projecte
                </Link>
            </div>
        </div>
    );
}
