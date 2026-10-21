"use client";

// Loads saved data from store.ts, keeps it in React state, and reloads whenever
// the store says something changed (including signing in or out). Pages read
// data from here and write through the store's functions.

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { X } from "lucide-react";
import { getBusinessType, type BusinessTypeInfo } from "./business-types";
import type { CatalogItem } from "./catalog";
import { roadmapProgress, type RoadmapProgress } from "./roadmap";
import {
  getAccount,
  getBusiness,
  getCatalog,
  getPartnerReplyCount,
  getEvents,
  getMode,
  getMoneyPlan,
  getShowSamples,
  getTasks,
  getTransactions,
  onSaveError,
  subscribe,
  type Account,
  type Business,
  type CalendarEvent,
  type Mode,
  type MoneyPlan,
  type Transaction,
} from "./store";

export type AppData = {
  /** null = not signed in and not trying the demo */
  account: Account | null;
  business: Business | null;
  mode: Mode | null;
  /** Fill the not-yet-built AI sections with sample content (demo and demo data only) */
  showSamples: boolean;
  completedTasks: string[];
  moneyPlan: MoneyPlan | null;
  transactions: Transaction[];
  events: CalendarEvent[];
  /** What the business sells, including hidden items (see src/lib/catalog.ts) */
  catalog: CatalogItem[];
  /** Partners who replied and are waiting on the owner (the blue badge) */
  partnerReplies: number;
};

type DataState = { data: AppData | null; loadFailed: boolean };

const DataContext = createContext<DataState>({ data: null, loadFailed: false });

async function loadAll(): Promise<AppData> {
  const account = await getAccount();
  if (!account) {
    return {
      account,
      business: null,
      mode: null,
      showSamples: false,
      completedTasks: [],
      moneyPlan: null,
      transactions: [],
      events: [],
      catalog: [],
      partnerReplies: 0,
    };
  }
  const [business, mode, showSamples, completedTasks, moneyPlan, transactions, events, catalog, partnerReplies] = await Promise.all([
    getBusiness(),
    getMode(),
    getShowSamples(),
    getTasks(),
    getMoneyPlan(),
    getTransactions(),
    getEvents(),
    getCatalog(),
    getPartnerReplyCount(),
  ]);
  return { account, business, mode, showSamples, completedTasks, moneyPlan, transactions, events, catalog, partnerReplies };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DataState>({ data: null, loadFailed: false });
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let latest = 0;
    const refresh = () => {
      const run = ++latest;
      loadAll().then(
        (data) => {
          // Ignore an older load that finishes after a newer one.
          if (alive && run === latest) setState({ data, loadFailed: false });
        },
        (error) => {
          console.error("Second could not load data:", error);
          if (alive && run === latest) setState((s) => ({ ...s, loadFailed: true }));
        },
      );
    };
    refresh();
    const unsubscribe = subscribe(refresh);
    const unsubscribeErrors = onSaveError(setSaveError);
    return () => {
      alive = false;
      unsubscribe();
      unsubscribeErrors();
    };
  }, []);

  // Keep the pre-paint mode attribute in step with saved data.
  const mode = state.data?.mode;
  useEffect(() => {
    if (mode) document.documentElement.dataset.mode = mode;
  }, [mode]);

  return (
    <DataContext.Provider value={state}>
      {children}
      {saveError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[560px] items-center gap-3 rounded-row border border-line-strong bg-card px-4 py-3 text-[15px] text-ink shadow-xl"
        >
          <span className="flex-1">{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            aria-label="Close this message"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </DataContext.Provider>
  );
}

/** All saved data, or null while it's still loading. */
export function useAppData(): AppData | null {
  return useContext(DataContext).data;
}

export type LoadedData = AppData & { business: Business; moneyPlan: MoneyPlan; typeInfo: BusinessTypeInfo };

/** For pages inside <RequireBusiness>: data is loaded and the profile exists. */
export function useLoadedData(): LoadedData {
  const data = useAppData();
  if (!data?.business) throw new Error("useLoadedData must be used inside <RequireBusiness>");
  return {
    ...data,
    business: data.business,
    moneyPlan: data.moneyPlan ?? { monthlyCosts: [], startupCosts: [], saved: 0 },
    typeInfo: getBusinessType(data.business.type),
  };
}

export function useRoadmap(): RoadmapProgress {
  const { business, completedTasks } = useLoadedData();
  return roadmapProgress(business.type, completedTasks);
}

function StatusScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-4 text-center text-muted" role="status">
      {children}
    </div>
  );
}

function LoadFailed() {
  return (
    <StatusScreen>
      <p className="m-0 max-w-sm text-[17px]">We couldn&apos;t load your business. Check your internet connection.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-11 items-center rounded-full bg-sky px-5 text-[15px] font-semibold text-on-sky hover:bg-sky-ink"
      >
        Try again
      </button>
    </StatusScreen>
  );
}

/** For pages that need someone signed in (or trying the demo). Sends everyone else to /login. */
export function RequireAccount({ children }: { children: React.ReactNode }) {
  const { data, loadFailed } = useContext(DataContext);
  const router = useRouter();
  const signedOut = data !== null && !data.account;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (loadFailed && !data) return <LoadFailed />;
  if (!data?.account) return <StatusScreen>{signedOut ? "Please log in first…" : "Loading…"}</StatusScreen>;
  return <>{children}</>;
}

/** Shows a quiet loading screen, sends signed-out people to /login and people without a profile to /start. */
export function RequireBusiness({ children }: { children: React.ReactNode }) {
  const { data, loadFailed } = useContext(DataContext);
  const router = useRouter();
  const target = data === null ? null : !data.account ? "/login" : !data.business ? "/start" : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (loadFailed && !data) return <LoadFailed />;
  if (!data?.business) {
    return (
      <StatusScreen>
        {target === "/login" ? "Please log in first…" : target === "/start" ? "Let's set up your business first…" : "Loading…"}
      </StatusScreen>
    );
  }
  return <>{children}</>;
}

/** Where someone's home is: their dashboard, their launch plan, or setup. */
export function homeFor(data: AppData | null): string {
  if (!data?.account) return "/login";
  if (!data.business) return "/start";
  return data.mode === "running" ? "/app" : "/launch";
}
