"use client";

import { useCallback } from "react";
import { useAppData } from "./data";
import { saveMode, type Mode } from "./store";

export type { Mode };

/** The saved mode (null until loaded or never picked) and a way to change it. */
export function useMode() {
  const data = useAppData();
  const setMode = useCallback(async (mode: Mode) => {
    document.documentElement.dataset.mode = mode;
    await saveMode(mode);
  }, []);
  return { mode: data?.mode ?? null, setMode };
}
