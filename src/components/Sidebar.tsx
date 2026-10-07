"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Book,
  CalendarDays,
  Camera,
  ChartNoAxesColumn,
  LayoutDashboard,
  Mail,
  Map,
  MessageCircle,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLoadedData, useRoadmap } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import type { Mode } from "@/lib/mode";
import { secondStatus } from "@/lib/demo-content";
import { SampleTag } from "./EmptyStates";
import { Logo } from "./Logo";
import { ProgressBar } from "./ProgressBar";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { label: string; href: string; icon: LucideIcon };

export const navItems: Record<Mode, NavItem[]> = {
  launch: [
    { label: "Launch plan", href: "/launch", icon: LayoutDashboard },
    { label: "Chat with Second", href: "/chat", icon: MessageCircle },
    { label: "Roadmap", href: "/launch/roadmap", icon: Map },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Money plan", href: "/launch/money", icon: ChartNoAxesColumn },
    { label: "Brand kit", href: "/launch/brand", icon: Star },
    { label: "Learn", href: "/learn", icon: Book },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
  running: [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "Calendar", href: "/calendar", icon: CalendarDays },
    { label: "Chat with Second", href: "/chat", icon: MessageCircle },
    { label: "Outreach", href: "/app/outreach", icon: Mail },
    { label: "Money", href: "/app/money", icon: ChartNoAxesColumn },
    { label: "Content", href: "/app/content", icon: Camera },
    { label: "Clients", href: "/app/clients", icon: Users },
    { label: "Learn", href: "/learn", icon: Book },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};

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
  const { business, showSamples } = useLoadedData();
  const roadmap = useRoadmap();
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

      <nav aria-label="Main" className="flex flex-col gap-1">
        {navItems[mode].map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline transition-colors ${
                active ? "bg-ink-line font-medium text-on-panel" : "text-on-dark hover:bg-ink-2 hover:text-on-panel"
              }`}
            >
              <Icon size={20} strokeWidth={2} aria-hidden="true" className={active ? "text-panel-accent" : ""} />
              {item.label}
              {showSamples && item.href === "/app/outreach" ? (
                <span className="ml-auto rounded-chip bg-mint px-2 py-0.5 text-xs font-semibold text-mint-ink">
                  3
                  <span className="sr-only"> new</span>
                </span>
              ) : null}
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
