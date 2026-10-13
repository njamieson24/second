"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/Card";
import { Field, inputClass } from "@/components/Field";
import { CATEGORIES, type CategoryId } from "@/lib/outreach";

export type SearchInput = { town: string; state: string; category: CategoryId; hideChains: boolean };

/** Town, state, kind of business, "Hide chains", and Find. */
export function SearchPanel({
  initial,
  busy,
  onSearch,
}: {
  initial: SearchInput;
  busy: boolean;
  onSearch: (input: SearchInput) => void;
}) {
  const [town, setTown] = useState(initial.town);
  const [state, setState] = useState(initial.state);
  const [category, setCategory] = useState<CategoryId>(initial.category);
  const [hideChains, setHideChains] = useState(initial.hideChains);

  return (
    <Card title="Find businesses near you">
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && town.trim()) onSearch({ town: town.trim(), state: state.trim(), category, hideChains });
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="Town">{(id) => <input id={id} className={inputClass} value={town} onChange={(e) => setTown(e.target.value)} maxLength={80} autoComplete="address-level2" required />}</Field>
          <Field label="State">{(id) => <input id={id} className={inputClass} value={state} onChange={(e) => setState(e.target.value)} maxLength={40} autoComplete="address-level1" placeholder="NJ" />}</Field>
        </div>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-[15px] font-medium">Kind of business</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={`min-h-11 rounded-full px-4 text-[15px] font-medium transition-colors ${
                  category === c.id ? "bg-sky text-on-sky" : "border border-line-strong bg-card text-ink hover:border-ink"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px]">
            <input type="checkbox" className="size-5 accent-sky" checked={hideChains} onChange={(e) => setHideChains(e.target.checked)} />
            Hide chains (big brands)
          </label>
          <button
            type="submit"
            disabled={busy || !town.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sky px-5 text-[15px] font-semibold text-on-sky transition-colors hover:bg-sky-ink disabled:cursor-wait disabled:opacity-60"
          >
            <Search size={17} aria-hidden="true" />
            {busy ? "Looking…" : "Find"}
          </button>
        </div>
      </form>
    </Card>
  );
}

/** The credit OpenStreetMap asks for wherever its data is shown. */
export function OsmCredit() {
  return (
    <p className="m-0 text-sm text-muted">
      Business list from{" "}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-sky-ink underline">
        © OpenStreetMap contributors
      </a>
      .
    </p>
  );
}
