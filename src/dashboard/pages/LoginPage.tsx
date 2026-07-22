import * as React from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { PhoneIncoming, CalendarCheck, Sparkles } from "lucide-react";
import { supabase } from "@lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DisplayCards from "@/components/ui/display-cards";

const featureCards = [
  {
    icon: <PhoneIncoming className="size-4 text-emerald-100" />,
    title: "Sofort erreichbar",
    description: "Verpasste Anrufe automatisch beantwortet",
    date: "Rund um die Uhr",
    iconClassName: "bg-primary",
    titleClassName: "text-primary",
    className:
      "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <CalendarCheck className="size-4 text-emerald-100" />,
    title: "Direkt gebucht",
    description: "Termine landen sofort im Kalender",
    date: "In Sekunden",
    iconClassName: "bg-primary",
    titleClassName: "text-primary",
    className:
      "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
  },
  {
    icon: <Sparkles className="size-4 text-emerald-100" />,
    title: "KI-qualifiziert",
    description: "Anliegen wird automatisch geklärt",
    date: "Ohne Wartezeit",
    iconClassName: "bg-primary",
    titleClassName: "text-primary",
    className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
  },
];

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
      <div className="flex w-full max-w-4xl items-center justify-center gap-16">
        <div className="hidden shrink-0 lg:block">
          <DisplayCards cards={featureCards} />
        </div>

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
    </div>
  );
}
