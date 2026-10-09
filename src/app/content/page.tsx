"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ContentCalendar, calendarDays, type CalendarView } from "@/components/content/ContentCalendar";
import { IdeaList } from "@/components/content/IdeaList";
import { PostEditor } from "@/components/content/PostEditor";
import { SampleTag } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { brandColors } from "@/lib/brand";
import type { ContentPost, ContentWeek } from "@/lib/content";
import { useLoadedData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { getContentPosts, getContentWeek, newContentIdeas, saveContentTone, type ContentTone } from "@/lib/store";

// Content: this week's post ideas, the editor (caption + branded template), and the content calendar.
// Shared by both modes. The ideas load on their own; the rest of the page never waits for them.

export default function ContentPage() {
  return (
    <AppShell mode="current">
      <Content />
    </AppShell>
  );
}

function Content() {
  const { business, account } = useLoadedData();
  const [week, setWeek] = useState<ContentWeek | null>(null);
  const [sample, setSample] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [calPosts, setCalPosts] = useState<ContentPost[]>([]);
  const [tone, setTone] = useState<ContentTone>(business.contentTone ?? "warm");
  const brand = useMemo(() => ({ ...brandColors(business), name: business.businessName || business.ownerName }), [business]);

  useEffect(() => {
    let live = true;
    getContentWeek().then((r) => {
      if (!live) return;
      if (r.ok) {
        setWeek(r.week);
        setSample(r.sample);
        setProblem(null);
        setSelectedId((id) => id ?? r.week.ideas[0]?.id ?? null);
      } else setProblem(r.message);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const days = calendarDays(view, anchor);
  const from = days[0];
  const to = days[days.length - 1];
  useEffect(() => {
    let live = true;
    getContentPosts(from, to).then((p) => live && setCalPosts(p));
    return () => {
      live = false;
    };
  }, [from, to, week]);

  const update = useCallback((id: string, changes: Partial<ContentPost>) => {
    setWeek((w) => (w ? { ...w, ideas: w.ideas.map((p) => (p.id === id ? { ...p, ...changes } : p)) } : w));
    setCalPosts((all) => all.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }, []);

  async function renew() {
    setRenewing(true);
    setProblem(null);
    const r = await newContentIdeas();
    setRenewing(false);
    if (r.ok) {
      setWeek(r.week);
      setSelectedId(r.week.ideas[0]?.id ?? null);
    } else setProblem(r.message);
  }

  async function changeTone(t: ContentTone) {
    setTone(t);
    if (!sample) await saveContentTone(t);
  }

  const selected = week?.ideas.find((p) => p.id === selectedId) ?? calPosts.find((p) => p.id === selectedId) ?? null;

  return (
    <PageBody>
      <PageHeader
        title="Content"
        subtitle="Post ideas, captions and images for this week. You post them yourself."
        eyebrow={sample || account?.kind === "demo" ? <SampleTag /> : undefined}
      />
      <IdeaList
        week={week}
        loading={!week && !problem}
        problem={problem}
        selectedId={selectedId}
        tone={tone}
        renewing={renewing}
        onSelect={setSelectedId}
        onTone={changeTone}
        onNewIdeas={renew}
        onRetry={() => setAttempt((n) => n + 1)}
      />
      {selected && <PostEditor key={selected.id} post={selected} brand={brand} onChange={(c) => update(selected.id, c)} />}
      <ContentCalendar view={view} anchor={anchor} posts={calPosts} selectedId={selectedId} onView={setView} onAnchor={setAnchor} onSelect={setSelectedId} />
    </PageBody>
  );
}
