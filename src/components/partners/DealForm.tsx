"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { inputClass, MoneyInput } from "@/components/Field";
import { activeItems, activeVariants, entryName, type CatalogItem } from "@/lib/catalog";
import type { DealTerms, Lead } from "@/lib/outreach";
import { saveDeal } from "@/lib/store";

/**
 * The deal you made with a partner: percent off, dollars off, or your own words. Optionally only
 * for one thing you sell. When you log money "from" this partner, the database works out the
 * discount from what's saved here (never below $0).
 */
export function DealForm({ lead, catalog, onDone }: { lead: Lead; catalog: CatalogItem[]; onDone: (deal: DealTerms | null) => void }) {
  const [type, setType] = useState<DealTerms["type"]>(lead.deal?.type ?? "percent");
  const [value, setValue] = useState<number>(lead.deal?.value ?? (type === "percent" ? 15 : 15));
  const [variantId, setVariantId] = useState<string>(lead.deal?.variantId ?? "");
  const [note, setNote] = useState(lead.deal?.note ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const options = activeItems(catalog).flatMap((i) => activeVariants(i).map((v) => ({ id: v.id, name: entryName(i, v, activeVariants(i).length) })));

  async function save() {
    setSaving(true);
    setProblem(null);
    const deal: DealTerms = { type, value: type === "custom" ? null : value, variantId: type === "custom" ? null : variantId || null, note: note.trim() || null };
    const r = await saveDeal(lead.id, deal);
    setSaving(false);
    if (!r.ok) return setProblem(r.message);
    onDone(deal);
  }

  const kinds: [DealTerms["type"], string][] = [
    ["percent", "% off"],
    ["amount_off", "$ off"],
    ["custom", "Something else"],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-row border border-line bg-paper p-3.5">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[15px] font-medium">The deal</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={type === k}
              onClick={() => setType(k)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium ${type === k ? "bg-sky text-on-sky" : "border border-line-strong bg-card text-ink hover:border-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {type === "percent" && (
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Percent off
          <input className={`${inputClass} w-32`} inputMode="numeric" value={value} onChange={(e) => setValue(Math.min(100, Number(e.target.value.replace(/[^\d.]/g, "")) || 0))} />
        </label>
      )}
      {type === "amount_off" && (
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Dollars off
          <MoneyInput value={value} onChange={setValue} label="Dollars off" className="w-36" />
        </label>
      )}
      {type !== "custom" && options.length > 0 && (
        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          On
          <select className={inputClass} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">Anything you sell</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        {type === "custom" ? "What's the deal?" : "Note (optional)"}
        <input className={inputClass} value={note} maxLength={200} placeholder={type === "custom" ? "Like: they hand out my cards, I hand out theirs" : "Like: for club members"} onChange={(e) => setNote(e.target.value)} />
      </label>
      {problem && (
        <p role="alert" className="m-0 text-[15px]">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save deal"}
        </Button>
        <Button size="sm" variant="soft" weight="medium" onClick={() => onDone(null)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
