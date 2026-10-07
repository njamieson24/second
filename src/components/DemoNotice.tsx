"use client";

import { useAppData } from "@/lib/data";
import { DemoBanner } from "./EmptyStates";

/** The demo banner, only while someone is trying the demo. */
export function DemoNotice() {
  return useAppData()?.account?.kind === "demo" ? <DemoBanner /> : null;
}
