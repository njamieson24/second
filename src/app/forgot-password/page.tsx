"use client";

import { useState } from "react";
import { AuthField, AuthShell, authInputClass, FormMessage, SubmitButton } from "@/components/AuthShell";
import { TextLink } from "@/components/TextLink";
import { sendPasswordReset } from "@/lib/store";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please type the email you used for your account.");
      return;
    }
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If there's an account for ${email.trim()}, we just sent it a link to choose a new password.`}
        footer={<TextLink href="/login">Back to log in</TextLink>}
      >
        <FormMessage tone="good">
          The link works for about an hour. Don&apos;t see it? Look in your spam or junk folder.
        </FormMessage>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="No problem. Type your email and we'll send you a link to choose a new one."
      footer={<TextLink href="/login">Back to log in</TextLink>}
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
        <SubmitButton busy={busy} busyLabel="Sending…">
          Send me a reset link
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
