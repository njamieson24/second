"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass } from "./Field";
import { Logo } from "./Logo";

/** Simple centered card for sign up, log in, and password pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-4 py-10 desk:py-14">
      <Link href="/" className="rounded-lg no-underline" aria-label="Second, home">
        <Logo size="lg" />
      </Link>
      <main className="mt-8 w-full max-w-[480px]">
        <div className="flex flex-col gap-6 rounded-card border border-line bg-card p-6 desk:p-8">
          <div>
            <h1 className="m-0 text-[30px] leading-tight font-semibold tracking-[-0.7px]">{title}</h1>
            {subtitle && <p className="mt-2 mb-0 text-[17px] leading-normal text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-6 flex flex-col items-center gap-3 text-center text-[16px]">{footer}</div>}
      </main>
    </div>
  );
}

/** Big, clear field for auth forms. */
export function AuthField({
  id,
  label,
  help,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[16px] font-medium">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="m-0 text-[15px] text-muted">
          {help}
        </p>
      )}
    </div>
  );
}

export const authInputClass = `${inputClass} min-h-14 text-[17px]`;

/** Password box with a Show / Hide button. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-describedby={describedBy}
        required
        className={`${authInputClass} pr-28`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-1.5 inline-flex min-h-11 -translate-y-1/2 items-center gap-1.5 rounded-xl px-3 text-[15px] font-medium text-sky-ink hover:bg-line-soft"
      >
        {shown ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}

/** The big submit button for auth forms. */
export function SubmitButton({ busy, children, busyLabel }: { busy: boolean; children: React.ReactNode; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-sky px-6 text-[17px] font-semibold text-on-sky hover:bg-sky-ink disabled:cursor-wait disabled:opacity-70"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

/** Plain-English problem message, read out by screen readers. */
export function FormMessage({ tone, children }: { tone: "error" | "good"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-row px-4 py-3.5 text-[16px] leading-normal ${
        tone === "error" ? "border border-line-strong bg-paper text-ink" : "bg-mint-tint text-mint-heading"
      }`}
    >
      {children}
    </div>
  );
}
