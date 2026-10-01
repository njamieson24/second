// Plain (non-client) module so the root layout can inline these scripts as text.
// Exporting strings from a "use client" file turns them into client references.

export const THEME_STORAGE_KEY = "second-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";
// Must match STORAGE_KEYS.modeHint in store.ts (kept as a plain string so this file
// doesn't pull the database code into the page's first script).
const MODE_HINT_KEY = "second:v1:mode-hint";

/**
 * Runs before first paint so the page never flashes the wrong theme or sidebar.
 * Sets html[data-theme] (light/dark) and html[data-mode] (launch/running).
 * The mode here is only a hint saved by store.ts; real data loads right after.
 */
export const bootScript =
  `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}` +
  `try{var m=localStorage.getItem("${MODE_HINT_KEY}");if(m==="launch"||m==="running")document.documentElement.dataset.mode=m}catch(e){}`;
