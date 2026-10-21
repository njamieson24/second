"use client";

import { AppShell } from "@/components/AppShell";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { ThisWeek } from "@/components/ThisWeek";

// This Week: the 3 things to do this week (also on Home). Its own page so it's in the menu.
export default function WeekPage() {
  return (
    <AppShell mode="current">
      <PageBody>
        <PageHeader size="sm" title="This Week" subtitle="Three things to do this week, picked for your business. Mark each one Done or Skip." />
        <ThisWeek />
      </PageBody>
    </AppShell>
  );
}
