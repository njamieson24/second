"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Book,
  CalendarDays,
  Camera,
  ChartNoAxesColumn,
  LayoutDashboard,
  Map,
  MessageCircle,
  Settings,
  Star,
  Users,
  type LucideIcon,
  Compass,
  Handshake,
  ListChecks,
} from "lucide-react";
import { useLoadedData, useRoadmap } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import type { Mode } from "@/lib/mode";
import { secondStatus } from "@/lib/demo-content";
import { SampleTag } from "./EmptyStates";
import { Logo } from "./Logo";
import { ProgressBar } from "./ProgressBar";
import { ThemeToggle } from "./ThemeToggle";
import { useTour } from "./Tour";

export type NavItem = { label: string; href: string; icon: LucideIcon; badge?: "replies" };

/**
 * The app's pages. Phone: `bar` is the bottom bar (plus "More"), `more` is the More sheet.
 * Computer: the sidebar shows both, in this order. Every page is reachable in both.
 */
export function navFor(mode: Mode): { bar: NavItem[]; more: NavItem[] } {
  const launch = mode === "launch";
  return {
    bar: [
      { label: "Home", href: launch ? "/launch" : "/app", icon: LayoutDashboard },
      { label: "Partners", href: "/partners", icon: Handshake, badge: "replies" },
      { label: "Chat", href: "/chat", icon: MessageCircle },
      { label: "Money", href: launch ? "/launch/money" : "/app/money", icon: ChartNoAxesColumn },
    ],
    more: [
      { label: "This Week", href: "/week", icon: ListChecks },
      { label: "Calendar", href: "/calendar", icon: CalendarDays },
      { label: "Content", href: "/content", icon: Camera },
      ...(launch
        ? [
            { label: "Roadmap", href: "/launch/roadmap", icon: Map },
            { label: "Brand kit", href: "/launch/brand", icon: Star },
          ]
        : [{ label: "Clients", href: "/app/clients", icon: Users }]),
      { label: "Learn", href: "/learn", icon: Book },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  };
}

/** Kept for anything that still lists all pages for a mode. */
export const navItems: Record<Mode, NavItem[]> = {
  launch: [...navFor("launch").bar, ...navFor("launch").more],
  running: [...navFor("running").bar, ...navFor("running").more],
};

/** Is this nav item the page we're on? */
export const isActive = (pathname: string, href: string) => pathname === href || (href !== "/app" && href !== "/launch" && pathname.startsWith(`${href}/`));

/** Blue count: partners who replied and are waiting on the owner. */
export function ReplyBadge({ count, className = "" }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span className={`inline-flex min-w-5 items-center justify-center rounded-full bg-sky px-1.5 text-xs leading-5 font-semibold text-on-sky ${className}`}>
      {count}
      <span className="sr-only"> {count === 1 ? "reply" : "replies"} waiting</span>
    </span>
  );
}

export function LaunchModePill() {
  return (
    <span className="self-start rounded-full border-[1.5px] border-panel-accent px-3 py-[5px] text-[13px] leading-tight font-semibold text-panel-accent">
      Launch mode
    </span>
  );
}

export function Sidebar({
  mode,
  className = "",
  onNavigate,
}: {
  mode: Mode;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isLaunch = mode === "launch";
  const { business, showSamples, partnerReplies } = useLoadedData();
  const roadmap = useRoadmap();
  const tour = useTour();
  const initial = business.ownerName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside
      className={`on-dark w-[280px] shrink-0 flex-col border-r border-ink-line bg-panel px-4 py-6 text-on-dark ${isLaunch ? "gap-[22px]" : "gap-7"} ${className}`}
    >
      <Link href={isLaunch ? "/launch" : "/app"} className="self-start rounded-lg px-2 no-underline" onClick={onNavigate}>
        <Logo tone="dark" />
        <span className="sr-only">, home</span>
      </Link>
      {isLaunch && (
        <div className="ml-2 flex">
          <LaunchModePill />
        </div>
      )}

      <nav aria-label="Main" className="flex flex-col gap-1" data-tour="nav-sidebar">
        {navItems[mode].map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline transition-colors ${
                active ? "bg-mint/15 font-semibold text-panel-accent" : "text-on-dark hover:bg-ink-2 hover:text-on-panel"
              }`}
            >
              <Icon size={20} strokeWidth={2} aria-hidden="true" />
              {item.label}
              {item.badge === "replies" && <ReplyBadge count={partnerReplies} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="grow" />

      {isLaunch ? (
        <div className="rounded-row bg-ink-2 p-4">
          <div className="flex justify-between text-[13px] font-semibold">
            <span className="text-panel-accent">Launch progress</span>
            <span className="text-on-panel">{roadmap.percent}%</span>
          </div>
          <ProgressBar percent={roadmap.percent} tone="mint" label="Launch progress" className="mt-2.5" />
          {business.openingDay && (
            <p className="mt-2.5 mb-0 text-[13px] text-muted-dark">
              Opening day target: {dayLabel(business.openingDay)}
            </p>
          )}
        </div>
      ) : (
        showSamples && pathname === "/app" && (
          <div className="rounded-row bg-ink-2 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-panel-accent">
              <span className="size-2 rounded-full bg-mint" aria-hidden="true" />
              Second is working
              <span className="ml-auto">
                <SampleTag />
              </span>
            </div>
            <p className="mt-2 mb-0 text-sm leading-[1.45] text-on-dark">{secondStatus.summary}</p>
          </div>
        )
      )}

      <button
        type="button"
        onClick={() => {
          onNavigate?.(); // close the phone menu first
          tour.start(mode);
        }}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-on-dark transition-colors hover:bg-ink-2 hover:text-on-panel"
      >
        <Compass size={20} strokeWidth={2} aria-hidden="true" />
        Take a tour
      </button>

      <ThemeToggle />

      <div className="flex items-center gap-2.5 px-1">
        <div className="flex size-10 items-center justify-center rounded-full bg-mint-tint font-semibold text-mint-deep">
          {initial}
        </div>
        <div>
          <div className="text-[15px] font-medium text-on-panel">{business.ownerName}</div>
          <div className="text-[13px] text-muted-dark">{business.businessName || business.typeLabel}</div>
        </div>
      </div>
    </aside>
  );
}
