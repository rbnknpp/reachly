import * as React from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function LoginPage() {
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!loading && session && profile) {
    return <Navigate to={profile.role === "agency" ? "/agency" : "/inbox"} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Anmeldung fehlgeschlagen", { description: error.message });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_20%,hsl(160_60%_92%),transparent_45%),radial-gradient(circle_at_85%_80%,hsl(160_50%_94%),transparent_40%)] bg-muted/20 p-4">
      <div className="flex flex-col items-center gap-6">
        <span className="flex h-10 w-10 -rotate-6 items-center justify-center rounded-lg bg-primary font-mono text-lg font-semibold text-primary-foreground shadow-md">
          R
        </span>
        <Card className="w-full max-w-sm shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader>
            <CardTitle className="text-lg">Anmelden</CardTitle>
            <CardDescription>Reachly – Verwaltung für Agentur und Mandanten</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting} className="mt-2">
                {submitting ? "Anmelden …" : "Anmelden"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
