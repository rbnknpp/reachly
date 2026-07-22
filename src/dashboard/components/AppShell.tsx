import { NavLink, Outlet } from "react-router-dom";
import { Inbox, CalendarClock, BarChart3, Building2, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150",
    isActive
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

export function AppShell() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between border-b border-border bg-card p-4 md:w-56 md:border-b-0 md:border-r">
        <div>
          <div className="mb-7 flex items-center gap-2 px-2">
            <span className="flex h-7 w-7 -rotate-6 items-center justify-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">
              R
            </span>
            <span className="text-lg font-semibold tracking-tight">Reachly</span>
          </div>
          <nav className="flex flex-row gap-1 md:flex-col">
            {profile?.role === "agency" && (
              <NavLink to="/agency" className={navItemClass}>
                <Building2 className="h-4 w-4" />
                Mandanten
              </NavLink>
            )}
            <NavLink to="/inbox" className={navItemClass}>
              <Inbox className="h-4 w-4" />
              Posteingang
            </NavLink>
            <NavLink to="/appointments" className={navItemClass}>
              <CalendarClock className="h-4 w-4" />
              Termine
            </NavLink>
            <NavLink to="/stats" className={navItemClass}>
              <BarChart3 className="h-4 w-4" />
              Statistik
            </NavLink>
            {profile?.role === "client" && (
              <NavLink to="/settings" className={navItemClass}>
                <Settings className="h-4 w-4" />
                Einstellungen
              </NavLink>
            )}
          </nav>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <span className="truncate text-xs font-medium text-muted-foreground">{profile?.display_name ?? "Konto"}</span>
          <button
            onClick={() => void signOut()}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Abmelden"
            title="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-background p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
