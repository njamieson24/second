"use client";

import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ComingSoon, SampleTag } from "@/components/EmptyStates";
import { useLoadedData } from "@/lib/data";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TipCard } from "@/components/TipCard";
import { lessons } from "@/lib/demo-content";

export default function LearnPage() {
  return (
    <AppShell mode="current">
      <Learn />
    </AppShell>
  );
}

function Learn() {
  const { showSamples } = useLoadedData();
  if (!showSamples) {
    return (
      <PageBody>
        <PageHeader size="lg" title="Learn" subtitle="Short lessons in plain English." />
        <ComingSoon
          title="Short lessons, when you need them"
          text="Second will show you a quick lesson at the right moment, like what an EIN is when you're about to get one."
          className="max-w-[720px]"
        />
      </PageBody>
    );
  }
  return (
      <PageBody>
        <PageHeader
          size="lg"
          title="Learn"
          subtitle="Short lessons in plain English. Second shows you the right one at the right time."
          actions={<SampleTag />}
        />

        <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Lessons for you" aside={<SampleTag />}>
            <ul className="mt-2 mb-0 list-none p-0">
              {lessons.map((lesson, i) => (
                <li
                  key={lesson.title}
                  className={`flex items-center gap-3 ${i === lessons.length - 1 ? "pt-3" : "border-b border-line-soft py-3"}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-tint text-sky">
                    <BookOpen size={20} aria-hidden="true" />
                  </span>
                  <span className="grow text-[15px] font-medium">{lesson.title}</span>
                  <span className="text-sm whitespace-nowrap text-muted">{lesson.minutes} min</span>
                </li>
              ))}
            </ul>
          </Card>

          <TipCard title="Have a question now?" className="flex flex-col gap-2.5">
            <p className="m-0 text-[15px] leading-normal text-mint-heading">
              You don&apos;t have to wait for a lesson. Ask Second in your own words.
            </p>
            <div>
              <Button href="/chat" variant="green">
                Ask Second
              </Button>
            </div>
          </TipCard>
        </div>
      </PageBody>
  );
}
