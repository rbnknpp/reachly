import { cn } from "@/lib/utils";

interface ReachlyLogoProps {
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
  size?: number;
  withWordmark?: boolean;
}

// Icon: ein Punkt (der Kunde) mit drei konzentrischen Signal-Boegen, die ihn
// erreichen - visualisiert "sofort erreichbar". Als eigene Komponente, damit
// AppShell/LoginPage/AcceptInvitePage nicht mehr drei leicht unterschiedliche
// Kopien des alten "R"-Badges pflegen.
export function ReachlyLogo({ className, iconClassName, wordmarkClassName, size = 32, withWordmark = true }: ReachlyLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("shrink-0", iconClassName)}
        {...(withWordmark ? { "aria-hidden": true } : { role: "img", "aria-label": "Reachly" })}
      >
        <rect width="40" height="40" rx="10" className="fill-primary" />
        <circle cx="13" cy="27" r="2.4" fill="#fff" />
        <path d="M13 21a6 6 0 0 1 6 6" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M13 17a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.85" />
        <path d="M13 13a14 14 0 0 1 14 14" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity="0.65" />
      </svg>
      {withWordmark && (
        <span className={cn("text-lg font-semibold tracking-tight text-foreground", wordmarkClassName)}>Reachly</span>
      )}
    </div>
  );
}
