import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@lib/supabase";
import type { Profile } from "@schema/database";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [passwordRecovery, setPasswordRecovery] = React.useState(false);

  const loadProfile = React.useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile((data as Profile) ?? null);
  }, []);

  React.useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const clearPasswordRecovery = React.useCallback(() => setPasswordRecovery(false), []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, passwordRecovery, clearPasswordRecovery, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
