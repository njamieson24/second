"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, FormMessage, PasswordInput, SubmitButton } from "@/components/AuthShell";
import { TextLink } from "@/components/TextLink";
import { homeFor, useAppData } from "@/lib/data";
import { updatePassword } from "@/lib/store";

const MIN_PASSWORD = 8;

// The link in the reset email opens this page and signs the person in for a moment,
// so they can pick a new password.
export default function ResetPasswordPage() {
  const router = useRouter();
  const data = useAppData();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} letters, numbers, or symbols for your password.`);
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setDone(true);
  }

  if (data === null) {
    return <AuthShell title="One moment…">{null}</AuthShell>;
  }

  if (data.account?.kind !== "user") {
    return (
      <AuthShell
        title="This link has expired"
        subtitle="Reset links only work once, for about an hour. Let's send you a new one."
        footer={<TextLink href="/login">Back to log in</TextLink>}
      >
        <TextLink href="/forgot-password" className="text-[17px]">
          Send me a new link
        </TextLink>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="All set!" subtitle="Your new password is saved. Use it next time you log in.">
        <button
          type="button"
          onClick={() => router.push(homeFor(data))}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-sky px-6 text-[17px] font-semibold text-on-sky hover:bg-sky-ink"
        >
          Take me to my business
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={`For ${data.account.email}`}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <AuthField id="password" label="New password" help={`At least ${MIN_PASSWORD} letters, numbers, or symbols.`}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            describedBy="password-help"
          />
        </AuthField>
        <SubmitButton busy={busy} busyLabel="Saving…">
          Save my new password
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
