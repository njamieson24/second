"use client";

import { useState } from "react";
import { HelpCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { MoneyInput } from "@/components/Field";
import type { CatalogDraft, DraftLine } from "@/lib/catalog-extract";
import { validPrice } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { applyCatalogDraft, findCatalogPrices } from "@/lib/store";

/**
 * "Find prices Second already knows": one tap runs one Haiku look at the owner's notes and
 * approved price cards. The draft is only shown here; nothing is saved until "Add".
 */
export function PriceDraft({ itemWord }: { itemWord: string }) {
  const [state, setState] = useState<"idle" | "looking" | "review" | "saving">("idle");
  const [draft, setDraft] = useState<CatalogDraft | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [sample, setSample] = useState(false);

  async function look() {
    setState("looking");
    setMessage(null);
    const r = await findCatalogPrices();
    if (!r.ok) {
      setState("idle");
      return setMessage(r.message);
    }
    setDraft(r.draft);
    setSample(r.sample);
    setChosen(Object.fromEntries(r.draft.lines.map((l) => [l.id, true])));
    setPrices(Object.fromEntries(r.draft.lines.map((l) => [l.id, l.price])));
    setMessage(r.message ?? null);
    setState(r.draft.lines.length || r.draft.questions.length ? "review" : "idle");
  }

  async function add() {
    if (!draft) return;
    const picked: DraftLine[] = draft.lines.filter((l) => chosen[l.id]).map((l) => ({ ...l, price: prices[l.id] ?? l.price }));
    if (picked.some((l) => !validPrice(l.price))) return setMessage("Prices go from $0 to $10,000.");
    setState("saving");
    const r = await applyCatalogDraft(picked);
    if (!r.ok) {
      setState("review");
      return setMessage(r.message);
    }
    setDraft(null);
    setState("idle");
    setMessage(r.saved ? `Added ${r.saved} to your list.` : "Nothing was added.");
  }

  const describe = (l: DraftLine) =>
    l.type === "new_item"
      ? `New: ${l.itemName}${l.optionLabel ? `, ${l.optionLabel}` : ""}`
      : l.type === "new_option"
        ? `New option for ${l.itemName}: ${l.optionLabel}`
        : `Update ${l.itemName}: ${formatMoney(l.oldPrice ?? 0)} → ${formatMoney(l.price)}`;
  const count = draft ? draft.lines.filter((l) => chosen[l.id]).length : 0;

  if (state !== "review" && state !== "saving") {
    return (
      <div className="mt-3 flex flex-col items-start gap-2">
        <Button size="sm" variant="soft" weight="medium" icon={<Sparkles size={15} aria-hidden="true" />} onClick={look} disabled={state === "looking"}>
          {state === "looking" ? "Looking through your notes…" : "Find prices Second already knows"}
        </Button>
        {message && (
          <p role="status" className="m-0 text-[15px] text-muted">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <section aria-labelledby="price-draft-title" className="mt-3 flex flex-col gap-3 rounded-row border border-sky bg-sky-tint p-4 text-ink">
      <div>
        <h3 id="price-draft-title" className="m-0 text-[17px] font-semibold">
          Second found these in your notes{sample ? " (sample)" : ""}
        </h3>
        <p className="m-0 mt-0.5 text-sm text-ink-soft">Check them, change any price, then add the ones you want. Nothing is saved until you tap Add.</p>
      </div>

      {draft!.lines.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {draft!.lines.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-row bg-card px-3.5 py-3">
              <label className="flex min-h-11 min-w-0 flex-1 basis-56 cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-sky" checked={chosen[l.id] ?? false} onChange={(e) => setChosen((c) => ({ ...c, [l.id]: e.target.checked }))} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-semibold">{describe(l)}</span>
                  <span className="text-sm text-muted">
                    From your {l.source.kind === "note" ? "note" : "approved card"}: &ldquo;{l.source.text}&rdquo;
                  </span>
                </span>
              </label>
              <div className="w-32">
                <MoneyInput value={prices[l.id] ?? l.price} onChange={(v) => setPrices((p) => ({ ...p, [l.id]: v }))} label={`Price for ${describe(l)}`} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft!.questions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="m-0 text-[15px] font-semibold">Second wasn&apos;t sure about these</h4>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {draft!.questions.map((q, n) => (
              <li key={n} className="flex items-start gap-2 text-[15px]">
                <HelpCircle size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-sky-ink" />
                <span>{q.question} You can add it yourself below, or tell Second in chat.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <p role="alert" className="m-0 text-[15px]">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {draft!.lines.length > 0 && (
          <Button size="sm" onClick={add} disabled={state === "saving" || count === 0}>
            {state === "saving" ? "Adding…" : `Add ${count} to my ${itemWord} list`}
          </Button>
        )}
        <Button
          size="sm"
          variant="soft"
          weight="medium"
          onClick={() => {
            setDraft(null);
            setState("idle");
            setMessage(null);
          }}
          disabled={state === "saving"}
        >
          {draft!.lines.length ? "Cancel" : "Close"}
        </Button>
      </div>
    </section>
  );
}
