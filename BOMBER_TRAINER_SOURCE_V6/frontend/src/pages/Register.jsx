import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { beginGoogleLogin } from "@/lib/googleOAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Register() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Les contrasenyes no coincideixen");
      return;
    }
    setLoading(true);
    try {
      // Direct PocketBase signup: create the user and log in immediately (no OTP).
      await signup(email, password);
      navigate(safeReturnTo(), { replace: true });
    } catch (err) {
      setError(err?.message || "No s'ha pogut crear el compte");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await beginGoogleLogin(safeReturnTo());
    } catch (err) {
      setError(err?.message || "Google no està disponible ara mateix.");
    }
  };

  return (
    <AuthLayout
      icon={UserPlus}
      title="Crea el teu compte"
      subtitle="Registra't per començar"
      footer={
        <>
          Ja tens compte?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline" data-testid="register-login-link">
            Entra
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
        data-testid="register-google-button"
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continua amb Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">o</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="register-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correu</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="email" data-testid="register-email-input" type="email" autoComplete="email" autoFocus placeholder="tu@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contrasenya</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="password" data-testid="register-password-input" type="password" autoComplete="new-password" minLength={8} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirma la contrasenya</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="confirm" data-testid="register-confirm-input" type="password" autoComplete="new-password" minLength={8} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading} data-testid="register-submit-button">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creant compte...
            </>
          ) : (
            "Crear compte"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
