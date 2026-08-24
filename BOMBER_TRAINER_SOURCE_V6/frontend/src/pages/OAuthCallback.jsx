import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import pb from "@/lib/pocketbaseClient";
import { logAuthenticatedAccess } from "../accessLogger";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(location.search);
        const code = params.get("code");
        const state = params.get("state");
        const saved = JSON.parse(sessionStorage.getItem("pb_oauth_provider") || "null");
        if (!saved) throw new Error("Falta l'estat OAuth. Torna a intentar-ho.");
        if (saved.state !== state) throw new Error("Estat OAuth no vàlid.");
        if (!code) throw new Error("Falta el codi d'autorització de Google.");

        const redirectURL = `${window.location.origin}/oauth/callback`;
        await pb.collection("users").authWithOAuth2Code("google", code, saved.codeVerifier, redirectURL);
        await logAuthenticatedAccess(pb.authStore.record, true);

        const returnTo = sessionStorage.getItem("pb_oauth_returnTo") || "/";
        sessionStorage.removeItem("pb_oauth_provider");
        sessionStorage.removeItem("pb_oauth_returnTo");
        navigate(returnTo, { replace: true });
      } catch (e) {
        setError(e?.message || "No s'ha pogut completar l'accés amb Google.");
      }
    })();
  }, [location.search, navigate]);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-4" data-testid="oauth-callback">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm border border-slate-200 text-center">
        {error ? (
          <>
            <p className="text-sm text-red-600" data-testid="oauth-callback-error">{error}</p>
            <button onClick={() => navigate("/login", { replace: true })} className="mt-4 w-full min-h-[48px] rounded-xl bg-slate-900 text-white font-bold" data-testid="oauth-callback-back">Torna a l'accés</button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /><p className="text-sm text-slate-500">Completant l'accés amb Google…</p></div>
        )}
      </div>
    </div>
  );
}
