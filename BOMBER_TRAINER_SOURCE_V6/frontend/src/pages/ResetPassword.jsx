import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import pb from "@/lib/pocketbaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Les contrasenyes no coincideixen");
      return;
    }
    setLoading(true);
    try {
      await pb.collection("users").confirmPasswordReset(resetToken, newPassword, confirmPassword);
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err?.message || "No s'ha pogut restablir la contrasenya");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="Enllaç no vàlid"
        subtitle="Aquest enllaç de restabliment falta o no és vàlid"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline" data-testid="reset-request-link">
            Demana un enllaç nou
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          L'enllaç sembla incomplet. Torna a demanar un correu de restabliment.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon={Lock} title="Nova contrasenya" subtitle="Introdueix la teva nova contrasenya">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="reset-error">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nova contrasenya</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" data-testid="reset-password-input" type="password" autoComplete="new-password" autoFocus minLength={8} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirma la contrasenya</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="confirm" data-testid="reset-confirm-input" type="password" autoComplete="new-password" minLength={8} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading} data-testid="reset-submit-button">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Restablint...
            </>
          ) : (
            "Restableix la contrasenya"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
