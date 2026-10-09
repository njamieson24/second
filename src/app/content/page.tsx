"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { BriefCard } from "@/components/content/BriefCard";
import { ContentCalendar, calendarDays, type CalendarView } from "@/components/content/ContentCalendar";
import { IdeaList } from "@/components/content/IdeaList";
import { SampleTag } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import type { ContentPost, ContentWeek } from "@/lib/content";
import { useLoadedData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { getContentPosts, getContentWeek, newContentIdeas, saveContentTone, type ContentTone } from "@/lib/store";

// Content: this week's post ideas as short creative briefs (what to post, format, phone shots,
// hook, best day), captions, and the content calendar. Shared by both modes.
// The briefs load on their own; the rest of the page never waits for them.

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
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [olderId, setOlderId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(todayISO());
  const [calPosts, setCalPosts] = useState<ContentPost[]>([]);
  const [tone, setTone] = useState<ContentTone>(business.contentTone ?? "warm");

  useEffect(() => {
    let live = true;
    getContentWeek().then((r) => {
      if (!live) return;
      if (r.ok) {
        setWeek(r.week);
        setSample(r.sample);
        setProblem(null);
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
    if (r.ok) setWeek(r.week);
    else setProblem(r.message);
  }

  async function changeTone(t: ContentTone) {
    setTone(t);
    if (!sample) await saveContentTone(t);
  }

  /** Calendar: this week's posts scroll to their card; older posts open below the calendar. */
  function openFromCalendar(id: string) {
    if (week?.ideas.some((p) => p.id === id)) {
      setOlderId(null);
      setHighlightId(id);
      document.getElementById(`brief-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else setOlderId(id);
  }
  const older = olderId ? calPosts.find((p) => p.id === olderId) ?? null : null;

  return (
    <PageBody>
      <PageHeader
        title="Content"
        subtitle="Shoot it on your phone. Real beats perfect."
        eyebrow={sample || account?.kind === "demo" ? <SampleTag /> : undefined}
      />
      <IdeaList
        week={week}
        loading={!week && !problem}
        problem={problem}
        highlightId={highlightId}
        tone={tone}
        renewing={renewing}
        onChange={update}
        onTone={changeTone}
        onNewIdeas={renew}
        onRetry={() => setAttempt((n) => n + 1)}
      />
      <ContentCalendar view={view} anchor={anchor} posts={calPosts} selectedId={highlightId ?? olderId} onView={setView} onAnchor={setAnchor} onSelect={openFromCalendar} />
      {older && (
        <Card title="From an earlier week" padding="lg">
          <div className="on-dark mt-3 rounded-row bg-panel p-2 text-on-panel">
            <BriefCard key={older.id} post={older} onChange={(c) => update(older.id, c)} />
          </div>
        </Card>
      )}
    </PageBody>
  );
}
