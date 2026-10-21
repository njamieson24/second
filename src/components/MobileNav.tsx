"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Compass, Ellipsis, X } from "lucide-react";
import { useLoadedData } from "@/lib/data";
import type { Mode } from "@/lib/mode";
import { Logo } from "./Logo";
import { isActive, LaunchModePill, navFor, ReplyBadge } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useTour } from "./Tour";

/**
 * Phone width: a small top bar (logo), and a bottom bar with Home · Partners · Chat · Money · More.
 * More opens a sheet with every other page, the tour and the light/dark switch.
 */
export function MobileNav({ mode, className = "" }: { mode: Mode; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();
  const pathname = usePathname();
  const { partnerReplies } = useLoadedData();
  const tour = useTour();
  const { bar, more } = navFor(mode);
  const moreActive = more.some((i) => isActive(pathname, i.href));

  return (
    <>
      <div className={`on-dark sticky top-0 z-30 bg-panel desk:hidden ${className}`}>
        <div className="flex min-h-14 items-center gap-3 px-4">
          <Link href={mode === "launch" ? "/launch" : "/app"} className="rounded-lg no-underline">
            <Logo tone="dark" />
            <span className="sr-only">, home</span>
          </Link>
          {mode === "launch" && (
            <span className="flex">
              <LaunchModePill />
            </span>
          )}
        </div>
      </div>

      <nav
        aria-label="Main"
        data-tour="nav-bar"
        className={`on-dark fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-panel pb-[env(safe-area-inset-bottom)] desk:hidden ${className}`}
      >
        <ul className="m-0 grid list-none grid-cols-5 p-0">
          {bar.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative mx-1 my-1.5 flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-xs no-underline ${
                    active ? "bg-mint/15 font-semibold text-panel-accent" : "text-on-dark"
                  }`}
                >
                  <Icon size={22} strokeWidth={2} aria-hidden="true" />
                  {item.label}
                  {item.badge === "replies" && <ReplyBadge count={partnerReplies} className="absolute top-0.5 left-[calc(50%+4px)]" />}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              aria-haspopup="dialog"
              className={`mx-1 my-1.5 flex min-h-13 w-[calc(100%-0.5rem)] flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${
                moreActive ? "bg-mint/15 font-semibold text-panel-accent" : "text-on-dark"
              }`}
            >
              <Ellipsis size={22} strokeWidth={2} aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialogRef}
        aria-label="More"
        className="on-dark mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-[24px] bg-panel p-0 text-on-dark backdrop:bg-scrim desk:hidden"
        onClick={(e) => {
          // Tapping the dimmed background closes the sheet.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="flex flex-col gap-2 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <h2 className="m-0 px-2 text-[17px] font-semibold text-on-panel">More</h2>
            <button type="button" onClick={close} className="flex size-11 items-center justify-center rounded-full text-on-panel hover:bg-ink-2" aria-label="Close">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0">
            {more.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] no-underline ${
                      active ? "bg-mint/15 font-semibold text-panel-accent" : "text-on-dark hover:bg-ink-2 hover:text-on-panel"
                    }`}
                  >
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              close();
              tour.start(mode);
            }}
            className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-on-dark hover:bg-ink-2 hover:text-on-panel"
          >
            <Compass size={20} strokeWidth={2} aria-hidden="true" />
            Take a tour
          </button>
          <ThemeToggle />
        </div>
      </dialog>
    </>
  );
}
