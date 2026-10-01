"use client";

import Link from "next/link";
import { useRef } from "react";
import { Menu, X } from "lucide-react";
import type { Mode } from "@/lib/mode";
import { Logo } from "./Logo";
import { LaunchModePill, Sidebar } from "./Sidebar";

/** Phone-width top bar. The menu button opens the full sidebar as a drawer. */
export function MobileNav({ mode, className = "" }: { mode: Mode; className?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();

  return (
    <div className={`on-dark sticky top-0 z-30 bg-panel desk:hidden ${className}`}>
      <div className="flex min-h-16 items-center gap-3 px-4">
        <Link href={mode === "launch" ? "/launch" : "/app"} className="rounded-lg no-underline">
          <Logo tone="dark" />
          <span className="sr-only">, home</span>
        </Link>
        {mode === "launch" && (
          <span className="flex">
            <LaunchModePill />
          </span>
        )}
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="ml-auto flex size-11 items-center justify-center rounded-full text-on-panel hover:bg-ink-2"
          aria-label="Open menu"
        >
          <Menu size={24} aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-[280px] max-w-[85vw] bg-transparent p-0 backdrop:bg-black/50"
        onClick={(e) => {
          // Clicking the dimmed backdrop closes the menu.
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="relative flex h-full">
          <Sidebar mode={mode} onNavigate={close} className="flex h-full w-full overflow-y-auto" />
          <button
            type="button"
            onClick={close}
            className="on-dark absolute top-5 right-3 flex size-11 items-center justify-center rounded-full text-on-panel hover:bg-ink-2"
            aria-label="Close menu"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </div>
  );
}
