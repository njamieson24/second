import { BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TipCard } from "@/components/TipCard";
import { lessons } from "@/lib/mock-data";

// Placeholder for Phase 1. Lessons will show up when they're useful.
export default function LearnPage() {
  return (
    <AppShell mode="current">
      <PageBody>
        <PageHeader
          size="lg"
          title="Learn"
          subtitle="Short lessons in plain English. Second shows you the right one at the right time."
          actions={<Chip tone="neutral">Coming soon</Chip>}
        />

        <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Lessons for you" aside={<span className="text-sm text-muted">Sample list</span>}>
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
    </AppShell>
  );
}
