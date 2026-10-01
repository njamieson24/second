"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthField, AuthShell, authInputClass, FormMessage, PasswordInput, SubmitButton } from "@/components/AuthShell";
import { TextLink } from "@/components/TextLink";
import { homeFor, useAppData } from "@/lib/data";
import { getBusiness, getMode, logIn } from "@/lib/store";

export default function LogInPage() {
  const router = useRouter();
  const data = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already logged in? Go straight home.
  const signedIn = data?.account?.kind === "user";
  useEffect(() => {
    if (signedIn && !busy) router.replace(homeFor(data));
  }, [signedIn, busy, data, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please type your email and your password.");
      return;
    }
    setBusy(true);
    const result = await logIn(email, password);
    if (!result.ok) {
      setBusy(false);
      setError(result.message);
      return;
    }
    const [business, mode] = await Promise.all([getBusiness(), getMode()]);
    router.push(!business ? "/start" : mode === "running" ? "/app" : "/launch");
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to pick up where you left off."
      footer={
        <>
          <span>
            New here? <TextLink href="/signup">Create an account</TextLink>
          </span>
          <TextLink href="/" className="text-[15px] font-normal">
            Back to the home page
          </TextLink>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <AuthField id="email" label="Your email">
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField id="password" label="Your password">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </AuthField>
        <SubmitButton busy={busy} busyLabel="Logging you in…">
          Log in
        </SubmitButton>
        <TextLink href="/forgot-password" className="self-center text-[16px]">
          Forgot your password?
        </TextLink>
      </form>
    </AuthShell>
  );
}
