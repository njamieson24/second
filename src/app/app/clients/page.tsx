"use client";

import { ComingSoon, SampleTag } from "@/components/EmptyStates";
import { useLoadedData } from "@/lib/data";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TipCard } from "@/components/TipCard";
import { todaySchedule } from "@/lib/demo-content";

function SampleClients() {
  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Clients"
        subtitle="Everyone you've worked with, and who's due for a visit"
        actions={<SampleTag />}
      />

      <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padding="lg" title="Your clients" aside={<SampleTag />}>
          <ul className="mt-2 mb-0 list-none p-0">
            {todaySchedule.map((c, i) => (
              <li
                key={c.name}
                className={`flex items-center gap-3 ${i === todaySchedule.length - 1 ? "pt-3" : "border-b border-line-soft py-3"}`}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-tint text-sm font-semibold text-sky-ink"
                  aria-hidden="true"
                >
                  {c.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div>
                  <div className="text-[15px] font-medium">{c.name}</div>
                  <div className="text-sm text-muted">{c.service}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <TipCard title="What's coming here" className="flex flex-col gap-2.5">
          <p className="m-0 text-[15px] leading-normal text-mint-heading">
            Second will remember each client&apos;s likes and notes, remind you who to rebook, and ask happy clients
            for reviews.
          </p>
          <div>
            <Button href="/chat" variant="green" pad="tight">
              Ask Second
            </Button>
          </div>
        </TipCard>
      </div>
    </PageBody>
  );
}

export default function ClientsPage() {
  const { showSamples } = useLoadedData();
  if (showSamples) return <SampleClients />;
  return (
    <PageBody>
      <PageHeader size="sm" title="Clients" subtitle="Everyone you work with" />
      <ComingSoon title="Your client list" text="Second will remember each client, remind you who is due for a visit, and help you ask happy clients for reviews." className="max-w-[720px]" />
    </PageBody>
  );
}
