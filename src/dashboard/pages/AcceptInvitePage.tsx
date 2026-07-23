import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Der Supabase-Einladungslink baut die Session automatisch auf (der
// AuthProvider/onAuthStateChange-Listener greift bereits) - diese Seite
// fragt nur noch nach einem selbst gewaehlten Passwort.
export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { clearPasswordRecovery } = useAuth();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error("Passwort konnte nicht gesetzt werden", { description: error.message });
      return;
    }
    toast.success("Passwort gesetzt – willkommen bei Reachly!");
    clearPasswordRecovery();
    navigate("/", { replace: true });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(160_60%_92%),transparent_45%),radial-gradient(circle_at_85%_80%,hsl(160_50%_94%),transparent_40%)] bg-muted/20 p-4">
      <div className="flex flex-col items-center gap-6">
        <span className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-lg bg-primary font-mono text-lg font-semibold text-primary-foreground shadow-md">
          R
        </span>
        <Card className="w-full max-w-sm shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader>
            <CardTitle className="text-lg">Willkommen bei Reachly</CardTitle>
            <CardDescription>Legen Sie ein Passwort für Ihren Zugang fest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Passwort wiederholen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? "Speichert …" : "Passwort festlegen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
