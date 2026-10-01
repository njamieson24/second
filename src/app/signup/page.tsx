"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, authInputClass, FormMessage, PasswordInput, SubmitButton } from "@/components/AuthShell";
import { TextLink } from "@/components/TextLink";
import { signUp } from "@/lib/store";

const MIN_PASSWORD = 8;

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Please use at least ${MIN_PASSWORD} letters, numbers, or symbols for your password.`);
      return;
    }
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.needsEmailConfirmation) return setCheckEmail(true);
    router.push("/start");
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" subtitle={`We sent a link to ${email}. Click it to finish making your account.`}>
        <FormMessage tone="good">Don&apos;t see it? Look in your spam or junk folder.</FormMessage>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="So your plan and your numbers are saved, and you can come back any time."
      footer={
        <>
          <span>
            Already have an account? <TextLink href="/login">Log in</TextLink>
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
        <AuthField id="password" label="Pick a password" help={`At least ${MIN_PASSWORD} letters, numbers, or symbols.`}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            describedBy="password-help"
          />
        </AuthField>
        <SubmitButton busy={busy} busyLabel="Making your account…">
          Create my account
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
