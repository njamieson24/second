// Plain (non-client) module so the root layout can inline these scripts as text.
// Exporting strings from a "use client" file turns them into client references.

import { STORAGE_KEYS } from "./store";

export const THEME_STORAGE_KEY = "second-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs before first paint so the page never flashes the wrong theme or sidebar.
 * Sets html[data-theme] (light/dark) and html[data-mode] (launch/running).
 * This is the one place outside store.ts that reads saved data, because it must
 * run before any app code loads.
 */
export const bootScript =
  `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}` +
  `try{var m=JSON.parse(localStorage.getItem("${STORAGE_KEYS.mode}"));if(m==="launch"||m==="running")document.documentElement.dataset.mode=m}catch(e){}`;
