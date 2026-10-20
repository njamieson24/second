"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PriceDraft } from "./PriceDraft";
import { inputClass, MoneyInput } from "@/components/Field";
import { familyOf } from "@/lib/business-kinds";
import { activeItems, activeVariants, newVariant, variantName, type CatalogItem, type CatalogVariant } from "@/lib/catalog";
import { useLoadedData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { hideCatalogItem, newId, saveCatalogItem } from "@/lib/store";

/**
 * "Services and prices" (or "Menu and prices"...): what the business sells, each with one or
 * more options (30/60/90 min, small/large) and a price. The one place prices are kept.
 * Removing an item hides it, so past money entries still show what they were.
 */
export function CatalogEditor() {
  const { business, catalog } = useLoadedData();
  const family = familyOf(business.type);
  const w = family.words;
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const items = activeItems(catalog);

  const blank = (): CatalogItem => ({
    id: newId(),
    name: "",
    kind: family.itemKind,
    active: true,
    position: catalog.reduce((max, i) => Math.max(max, i.position + 1), 0),
    variants: [{ ...newVariant(0), isDefault: true }],
  });

  return (
    <Card title={w.catalogTitle} tourId="catalog">
      <p className="mt-1 mb-3 text-sm text-muted">
        Second uses these prices everywhere: when you log money, in your weekly plan, posts and emails.
      </p>
      {items.length === 0 && !editing && <p className="m-0 text-[15px] text-muted">Nothing here yet. Add your first {w.item}.</p>}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) =>
          editing?.id === item.id ? (
            <li key={item.id}>
              <ItemForm item={editing} usesMinutes={family.usesMinutes} words={w} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-row border border-line-soft px-3.5 py-2.5">
              <div className="min-w-0 flex-1 basis-48">
                <div className="text-[15px] font-semibold">{item.name}</div>
                <div className="text-sm text-muted">
                  {activeVariants(item)
                    .map((v) => [variantName(v), formatMoney(v.price)].filter(Boolean).join(" "))
                    .join("  ·  ")}
                </div>
              </div>
              <Button size="sm" variant="soft" weight="medium" icon={<Pencil size={15} aria-hidden="true" />} onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>
                Edit
              </Button>
            </li>
          ),
        )}
      </ul>
      {editing && !items.some((i) => i.id === editing.id) ? (
        <div className="mt-2">
          <ItemForm item={editing} usesMinutes={family.usesMinutes} words={w} onDone={() => setEditing(null)} isNew />
        </div>
      ) : (
        !editing && (
          <div className="mt-3">
            <Button size="sm" variant="soft" weight="medium" icon={<Plus size={15} aria-hidden="true" />} onClick={() => setEditing(blank())}>
              Add a {w.item}
            </Button>
          </div>
        )
      )}
      {!editing && <PriceDraft itemWord={w.item} />}
    </Card>
  );
}

function ItemForm({
  item: start,
  usesMinutes,
  words,
  onDone,
  isNew,
}: {
  item: CatalogItem;
  usesMinutes: boolean;
  words: ReturnType<typeof familyOf>["words"];
  onDone: () => void;
  isNew?: boolean;
}) {
  const [item, setItem] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const shown = item.variants.filter((v) => v.active);
  const several = shown.length > 1;

  const setVariant = (id: string, patch: Partial<CatalogVariant>) => setItem((i) => ({ ...i, variants: i.variants.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
  const addVariant = () =>
    setItem((i) => {
      // Going from one price to several: name the first one from its length ("60 min").
      const named = i.variants.map((v) => (v.active && !v.label.trim() && v.minutes ? { ...v, label: `${v.minutes} min` } : v));
      return { ...i, variants: [...named, newVariant(i.variants.reduce((m, v) => Math.max(m, v.position + 1), 0))] };
    });
  // Options are never deleted (past entries point at them), only hidden.
  const removeVariant = (id: string) => setItem((i) => ({ ...i, variants: i.variants.map((v) => (v.id === id ? { ...v, active: false } : v)) }));

  async function save() {
    setSaving(true);
    setProblem(null);
    // One option left: it's the default, and doesn't need a name.
    const variants = item.variants.map((v) => ({ ...v, label: v.label.trim(), isDefault: v.active && v.id === shown[0]?.id }));
    const r = await saveCatalogItem({ ...item, variants });
    setSaving(false);
    if (!r.ok) return setProblem(r.message);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-row border border-line bg-paper p-4">
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Name
        <input className={inputClass} value={item.name} maxLength={80} placeholder={`Like "${words.itemExample}"`} onChange={(e) => setItem({ ...item, name: e.target.value })} autoFocus={isNew} />
      </label>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[15px] font-medium">{several ? `Prices by ${words.variantNoun}` : "Price"}</legend>
        {shown.map((v) => (
          <div key={v.id} className="flex flex-wrap items-end gap-2">
            {several && (
              <label className="flex min-w-0 flex-1 basis-32 flex-col gap-1 text-sm text-muted">
                {words.variantNoun[0].toUpperCase() + words.variantNoun.slice(1)}
                <input
                  className={inputClass}
                  value={v.label}
                  maxLength={40}
                  placeholder={words.variantExamples.split(",")[0].trim()}
                  onChange={(e) => {
                    const label = e.target.value;
                    const m = usesMinutes ? /^(\d{1,4})\s*(min|minutes?)?$/i.exec(label.trim()) : null;
                    setVariant(v.id, { label, ...(usesMinutes ? { minutes: m ? Number(m[1]) : v.minutes } : {}) });
                  }}
                />
              </label>
            )}
            {!several && usesMinutes && (
              <label className="flex w-28 flex-col gap-1 text-sm text-muted">
                Minutes
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={v.minutes ?? ""}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ""));
                    setVariant(v.id, { minutes: n > 0 ? Math.min(n, 1440) : null });
                  }}
                />
              </label>
            )}
            <label className="flex w-36 flex-col gap-1 text-sm text-muted">
              Price
              <MoneyInput value={v.price} onChange={(price) => setVariant(v.id, { price })} label={`Price${v.label ? ` for ${v.label}` : ""}`} />
            </label>
            {several && (
              <button
                type="button"
                onClick={() => removeVariant(v.id)}
                aria-label={`Remove ${v.label || "this option"}`}
                className="flex size-12 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
              >
                <Trash2 size={17} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        <div>
          <Button size="sm" variant="soft" weight="medium" icon={<Plus size={15} aria-hidden="true" />} onClick={addVariant}>
            Add a {words.variantNoun} ({words.variantExamples})
          </Button>
        </div>
      </fieldset>

      {problem && (
        <p role="alert" className="m-0 text-[15px] text-ink">
          {problem}
        </p>
      )}
      {confirmRemove ? (
        <div className="flex flex-col gap-2 rounded-row bg-card px-3 py-2.5">
          <p className="m-0 text-[15px]">
            Remove <span className="font-semibold">{item.name || `this ${words.item}`}</span>? Money you already logged for it stays as it is.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="dark"
              onClick={async () => {
                await hideCatalogItem(item.id);
                onDone();
              }}
            >
              Remove
            </Button>
            <Button size="sm" variant="soft" weight="medium" onClick={() => setConfirmRemove(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="soft" weight="medium" onClick={onDone} disabled={saving}>
            Cancel
          </Button>
          {!isNew && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-line-soft hover:text-ink"
            >
              <Trash2 size={15} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
