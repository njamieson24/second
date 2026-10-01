"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLoadedData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { useMode } from "@/lib/mode";
import { leaveDemo, logOut, resetAll } from "@/lib/store";

export default function SettingsPage() {
  return (
    <AppShell mode="current">
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { account, business, completedTasks, transactions } = useLoadedData();
  const demo = account?.kind === "demo";
  const [leaving, setLeaving] = useState(false);
  const { mode, setMode } = useMode();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const otherMode = mode === "launch" ? "running" : "launch";

  async function reset() {
    setResetting(true);
    await resetAll();
    router.replace("/start");
  }

  return (
    <PageBody>
      <PageHeader size="lg" title="Settings" subtitle="Your account, your answers, how Second looks, and starting over." />

      <Card title={demo ? "You're trying the demo" : "Your account"}>
        {demo ? (
          <>
            <p className="mt-1.5 mb-4 text-[15px] leading-normal text-muted">
              Nothing is saved to an account. What you enter stays in this browser only. Make an account to keep
              your plan safe and use it on any device.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/signup">Create an account</Button>
              <Button
                variant="ghost"
                weight="medium"
                onClick={async () => {
                  setLeaving(true);
                  await leaveDemo();
                  // A fresh page load on purpose: clears the demo data from memory.
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.assign("/");
                }}
              >
                {leaving ? "Leaving…" : "Leave the demo"}
              </Button>
            </div>
          </>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-4">
            <p className="m-0 text-[15px] leading-normal">
              <span className="text-muted">Logged in as </span>
              <b className="font-semibold">{account?.kind === "user" ? account.email : ""}</b>
            </p>
            <Button
              variant="ghost"
              weight="medium"
              onClick={async () => {
                setLeaving(true);
                await logOut();
                // A fresh page load on purpose: clears the old account from memory.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign("/");
              }}
            >
              {leaving ? "Logging out…" : "Log out"}
            </Button>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-2">
        <Card title="Your business" aside={<Chip tone="sky">{mode === "launch" ? "Launch mode" : "Running mode"}</Chip>}>
          <dl className="mt-3.5 mb-0 flex flex-col gap-3 text-[15px]">
            <Row label="Name" value={business.ownerName} />
            <Row label="Business" value={business.businessName || "Not picked yet"} />
            <Row label="Type" value={business.typeLabel} />
            <Row label="Area" value={business.area} />
            <Row label="Services" value={business.services.map((s) => `${s.name} (${formatMoney(s.price)})`).join(", ")} />
            <Row label="Pay goal" value={`${formatMoney(business.payGoal)} a month`} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button href="/start/setup" variant="ghost" weight="medium">
              Change my answers
            </Button>
            <Button
              variant="ghost"
              weight="medium"
              onClick={async () => {
                await setMode(otherMode);
                router.push(otherMode === "launch" ? "/launch" : "/app");
              }}
            >
              Switch to {otherMode === "launch" ? "Launch" : "Running"} mode
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Screen colors">
            <p className="mt-1.5 mb-3 text-[15px] text-muted">Auto matches your phone or computer.</p>
            <ThemeToggle tone="page" className="max-w-[300px]" />
          </Card>

          <Card title="Start over">
            <p className="mt-1.5 mb-4 text-[15px] leading-normal text-muted">
              This deletes {demo ? "everything Second saved in this browser" : "your business data from your account"}:
              your answers, {completedTasks.length} finished roadmap {completedTasks.length === 1 ? "step" : "steps"},
              your money plan, and {transactions.length} money {transactions.length === 1 ? "entry" : "entries"}.
              {demo ? "" : " Your login stays, so you can start again right away."}
            </p>
            {confirming ? (
              <div className="rounded-row border border-line-strong bg-paper p-4" role="alert">
                <p className="mt-0 mb-3 text-[15px] font-medium">Are you sure? This can&apos;t be undone.</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="dark" onClick={reset}>
                    {resetting ? "Resetting…" : "Yes, reset everything"}
                  </Button>
                  <Button variant="ghost" weight="medium" onClick={() => setConfirming(false)}>
                    Keep my data
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" weight="medium" onClick={() => setConfirming(true)}>
                {demo ? "Reset demo data" : "Start over"}
              </Button>
            )}
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}
