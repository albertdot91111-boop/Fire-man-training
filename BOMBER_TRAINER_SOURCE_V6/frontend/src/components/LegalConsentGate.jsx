import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, Cookie, Check } from 'lucide-react';

const CONSENT_KEY = 'bt-legal-consent-v2';
const LEGAL_VERSION = '2026-09-20';

export function hasLegalConsent() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return saved?.status === 'accepted' && saved?.version === LEGAL_VERSION && Boolean(saved?.acceptedAt);
  } catch { return false; }
}

export default function LegalConsentGate({ onAccepted }) {
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  const accept = () => {
    if (!terms || !privacy) return;
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ status: 'accepted', version: LEGAL_VERSION, acceptedAt: new Date().toISOString(), privacyAcknowledged: true, termsAccepted: true }));
    onAccepted?.();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="legal-consent-title">
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-900 text-white flex items-center justify-center"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-slate-400">BOMBER TRAINER</p>
              <h2 id="legal-consent-title" className="mt-1 text-2xl font-black">Abans de continuar</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Abans d'utilitzar l'app, informa't de com tractem les teves dades i de les condicions del servei.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Link to="/legal/privacitat" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
              <ShieldCheck className="h-5 w-5 text-slate-700" />
              <span className="flex-1"><strong className="block text-sm">Política de privacitat</strong><span className="text-xs text-slate-500">Quines dades tractem, per què i quins drets tens.</span></span>
              <span className="text-slate-400">›</span>
            </Link>
            <Link to="/legal/condicions" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
              <FileText className="h-5 w-5 text-slate-700" />
              <span className="flex-1"><strong className="block text-sm">Condicions d'ús</strong><span className="text-xs text-slate-500">Normes d'utilització i responsabilitats.</span></span>
              <span className="text-slate-400">›</span>
            </Link>
            <Link to="/legal/cookies" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
              <Cookie className="h-5 w-5 text-slate-700" />
              <span className="flex-1"><strong className="block text-sm">Política de cookies</strong><span className="text-xs text-slate-500">Informació sobre cookies i tecnologies similars.</span></span>
              <span className="text-slate-400">›</span>
            </Link>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 space-y-3">
            <label className="flex gap-3 items-start cursor-pointer">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} className="mt-1 h-4 w-4 rounded" />
              <span className="text-sm leading-5">He llegit la <Link to="/legal/privacitat" className="font-bold underline">Política de privacitat</Link> i la informació bàsica sobre el tractament de les meves dades.</span>
            </label>
            <label className="flex gap-3 items-start cursor-pointer">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 h-4 w-4 rounded" />
              <span className="text-sm leading-5">Accepto les <Link to="/legal/condicions" className="font-bold underline">Condicions d'ús</Link> de BOMBER TRAINER.</span>
            </label>
          </div>

          <button type="button" disabled={!terms || !privacy} onClick={accept} className="mt-5 w-full min-h-[52px] rounded-2xl bg-slate-900 text-white font-black disabled:opacity-40 flex items-center justify-center gap-2">
            <Check className="h-5 w-5" /> Continuar
          </button>
          <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">Els consentiments que siguin necessaris per a finalitats concretes es demanaran per separat. Pots consultar les polítiques en qualsevol moment.</p>
        </div>
      </div>
    </div>
  );
}

export function resetLegalConsent() {
  try { localStorage.removeItem(CONSENT_KEY); } catch {}
}
