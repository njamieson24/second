import { RequireBusiness } from "@/lib/data";
import type { Mode } from "@/lib/mode";
import { DemoNotice } from "./DemoNotice";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

/**
 * Sidebar + page. Pages inside need a saved business profile (see RequireBusiness).
 * `mode="current"` is for pages shared by both modes (/chat, /learn):
 * both sidebars render and CSS shows the one matching the saved mode (see globals.css).
 */
export function AppShell({
  mode,
  aside,
  children,
}: {
  mode: Mode | "current";
  /** Optional right-hand panel, desktop only */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const modes: Mode[] = mode === "current" ? ["launch", "running"] : [mode];
  const onlyClass = (m: Mode) => (mode === "current" ? `mode-only-${m}` : "");

  return (
    <RequireBusiness>
    <div className="flex min-h-screen flex-col desk:flex-row">
      {modes.map((m) => (
        <MobileNav key={`mobile-${m}`} mode={m} className={onlyClass(m)} />
      ))}
      {modes.map((m) => (
        // Pinned to the viewport so the bottom items (theme switch, user) never scroll away.
        <Sidebar
          key={`side-${m}`}
          mode={m}
          className={`hidden desk:sticky desk:top-0 desk:flex desk:h-screen desk:overflow-y-auto ${onlyClass(m)}`}
        />
      ))}
      <main className="min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] desk:pb-0">
        <DemoNotice />
        {children}
      </main>
      {aside}
    </div>
    </RequireBusiness>
  );
}

/** Wraps content that differs by mode on shared pages. */
export function ModeOnly({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return <div className={`contents mode-only-${mode}`}>{children}</div>;
}
