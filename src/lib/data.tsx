"use client";

// Loads saved data from store.ts once, keeps it in React state, and reloads
// whenever the store says something changed. Pages read data from here and
// write through the store's functions.

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { getBusinessType, type BusinessTypeInfo } from "./business-types";
import { roadmapProgress, type RoadmapProgress } from "./roadmap";
import {
  getBusiness,
  getMode,
  getMoneyPlan,
  getTasks,
  getTransactions,
  subscribe,
  type Business,
  type Mode,
  type MoneyPlan,
  type Transaction,
} from "./store";

export type AppData = {
  business: Business | null;
  mode: Mode | null;
  completedTasks: string[];
  moneyPlan: MoneyPlan | null;
  transactions: Transaction[];
};

const DataContext = createContext<AppData | null>(null);

async function loadAll(): Promise<AppData> {
  const [business, mode, completedTasks, moneyPlan, transactions] = await Promise.all([
    getBusiness(),
    getMode(),
    getTasks(),
    getMoneyPlan(),
    getTransactions(),
  ]);
  return { business, mode, completedTasks, moneyPlan, transactions };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      loadAll().then((next) => {
        if (alive) setData(next);
      });
    };
    refresh();
    const unsubscribe = subscribe(refresh);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Keep the pre-paint mode attribute in step with saved data.
  useEffect(() => {
    if (data?.mode) document.documentElement.dataset.mode = data.mode;
  }, [data?.mode]);

  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

/** All saved data, or null while it's still loading. */
export function useAppData(): AppData | null {
  return useContext(DataContext);
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

/** Shows a quiet loading screen, and sends people without a profile to /start. */
export function RequireBusiness({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const router = useRouter();
  const missing = data !== null && !data.business;

  useEffect(() => {
    if (missing) router.replace("/start");
  }, [missing, router]);

  if (!data?.business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-muted" role="status">
        {missing ? "Let's set up your business first…" : "Loading…"}
      </div>
    );
  }
  return <>{children}</>;
}
