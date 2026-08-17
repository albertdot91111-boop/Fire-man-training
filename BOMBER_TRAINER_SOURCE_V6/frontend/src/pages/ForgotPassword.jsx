import React, { useState } from "react";
import { Link } from "react-router-dom";
import pb from "@/lib/pocketbaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // PocketBase queues a reset email. NOTE: no email is actually delivered
      // until SMTP is configured in PocketBase settings.
      await pb.collection("users").requestPasswordReset(email);
    } catch {
      // Always show success regardless (avoid account enumeration).
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Recupera la contrasenya"
      subtitle="T'enviarem un enllaç per restablir-la"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline" data-testid="forgot-back-link">
          <ArrowLeft className="w-3 h-3 inline mr-1" />Torna a l'accés
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center" data-testid="forgot-sent-message">
          Si existeix un compte amb aquest correu, rebràs un enllaç per restablir la contrasenya.
          <br />
          <span className="text-xs text-muted-foreground">(Els correus no s'enviaran fins que es configuri l'SMTP a PocketBase.)</span>
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correu electrònic</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input id="email" data-testid="forgot-email-input" type="email" autoComplete="email" autoFocus placeholder="tu@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading} data-testid="forgot-submit-button">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviant...
              </>
            ) : (
              "Envia l'enllaç"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
