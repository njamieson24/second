// The catalog: what the business sells, with variants and prices. The ONE source of truth for
// prices (supabase/catalog.sql). businesses.services is old and nothing writes to it anymore.
//
// Everything that used `business.services` still works: `servicesFromCatalog` gives the same
// shape (one entry per active variant), and store.ts / the server routes fill it in from the
// catalog. Shared by the browser and the server.

import type { BusinessType } from "./business-types";
import { familyOf } from "./business-kinds";
import type { Service } from "./store";

export type CatalogVariant = {
  id: string;
  /** "60 min", "Large". Empty for the single default variant of a one-price item. */
  label: string;
  minutes: number | null;
  price: number;
  isDefault: boolean;
  active: boolean;
  position: number;
};

export type CatalogItem = {
  id: string;
  name: string;
  kind: "service" | "menu_item" | "product";
  /** Hidden items (deleted) stay so past money entries still show what they were */
  active: boolean;
  position: number;
  variants: CatalogVariant[];
};

export const CATALOG_LIMITS = {
  /** Catalog prices: $0 (free consults) to $10,000 */
  maxPrice: 10_000,
  /** One money entry or one daily total */
  maxEntry: 100_000,
  maxItems: 100,
  maxVariants: 10,
  nameMax: 80,
  labelMax: 40,
  maxQuantity: 1000,
} as const;

const cents = (n: number) => Math.round(n * 100) / 100;
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** A catalog price: a number from $0 to $10,000 with at most 2 decimals. */
export const validPrice = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= CATALOG_LIMITS.maxPrice && twoDecimals(n);

/** A money amount (entry, tip, discount, daily total): $0 to $100,000, at most 2 decimals. */
export const validAmount = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= CATALOG_LIMITS.maxEntry && twoDecimals(n);

/** What a variant is called on a button: its label, or its length, or "" for a one-price item. */
export function variantName(v: Pick<CatalogVariant, "label" | "minutes">): string {
  return v.label.trim() || (v.minutes ? `${v.minutes} min` : "");
}

/** "Aromatherapy, 60 min" or just "Aromatherapy" */
export function entryName(item: Pick<CatalogItem, "name">, v: Pick<CatalogVariant, "label" | "minutes">, itemCount = 2): string {
  const vn = variantName(v);
  return vn && itemCount > 1 ? `${item.name}, ${vn}` : item.name;
}

export const activeVariants = (item: CatalogItem) => item.variants.filter((v) => v.active).sort((a, b) => a.position - b.position);
export const activeItems = (items: CatalogItem[]) => items.filter((i) => i.active && activeVariants(i).length).sort((a, b) => a.position - b.position);

/**
 * The old `business.services` shape, made from the catalog: one entry per active variant.
 * `id` is the variant id. Names include the variant when an item has more than one.
 */
export function servicesFromCatalog(items: CatalogItem[]): Service[] {
  return activeItems(items).flatMap((item) => {
    const vs = activeVariants(item);
    return vs.map((v) => ({
      id: v.id,
      name: entryName(item, v, vs.length),
      price: v.price,
      ...(v.minutes ? { minutes: v.minutes } : {}),
    }));
  });
}

/** Find the item and variant behind a services-shaped entry (by variant id, or by name). */
export function findVariant(items: CatalogItem[], serviceIdOrName: string): { item: CatalogItem; variant: CatalogVariant } | null {
  const key = serviceIdOrName.trim().toLowerCase();
  for (const item of items) {
    const vs = activeVariants(item);
    for (const v of vs) {
      if (v.id === serviceIdOrName || entryName(item, v, vs.length).toLowerCase() === key) return { item, variant: v };
    }
    if (item.active && item.name.trim().toLowerCase() === key && vs.length === 1) return { item, variant: vs[0] };
  }
  return null;
}

/** price x quantity - discount + tip, in cents. The database does the same sum (and wins). */
export function entryTotal(parts: { unitPrice: number; quantity?: number; discount?: number; tip?: number }): number {
  return cents(parts.unitPrice * (parts.quantity ?? 1) - (parts.discount ?? 0) + (parts.tip ?? 0));
}

let counter = 0;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${++counter}`);

/** A one-price item (one default variant), e.g. from onboarding or "add service" in chat. */
export function newItem(input: { name: string; price: number; minutes?: number | null; type: BusinessType | string; position: number }): CatalogItem {
  return {
    id: newKey(),
    name: input.name.trim().slice(0, CATALOG_LIMITS.nameMax),
    kind: familyOf(input.type).itemKind,
    active: true,
    position: input.position,
    variants: [{ id: newKey(), label: "", minutes: input.minutes ?? null, price: cents(input.price), isDefault: true, active: true, position: 0 }],
  };
}

export function newVariant(position: number, label = "", price = 0, minutes: number | null = null): CatalogVariant {
  return { id: newKey(), label, minutes, price, isDefault: false, active: true, position };
}

/** The main price (money plan math): the first item's default variant. */
export function mainPrice(items: CatalogItem[]): number {
  const first = activeItems(items)[0];
  if (!first) return 0;
  const vs = activeVariants(first);
  return (vs.find((v) => v.isDefault) ?? vs[0])?.price ?? 0;
}

/** Problems with an item before saving (the database checks again). */
export function itemProblems(item: CatalogItem): string[] {
  const out: string[] = [];
  if (!item.name.trim()) out.push("Give it a name.");
  if (item.name.trim().length > CATALOG_LIMITS.nameMax) out.push(`Keep the name under ${CATALOG_LIMITS.nameMax} letters.`);
  const vs = item.variants.filter((v) => v.active);
  if (!vs.length) out.push("Add at least one price.");
  if (vs.length > CATALOG_LIMITS.maxVariants) out.push(`At most ${CATALOG_LIMITS.maxVariants} options.`);
  const labels = new Set<string>();
  for (const v of item.variants) {
    if (!validPrice(v.price)) out.push("Prices go from $0 to $10,000.");
    const key = v.label.trim().toLowerCase();
    if (labels.has(key)) out.push(vs.length > 1 && !key ? "Give each option a name, like 60 min or Large." : `"${v.label}" is listed twice.`);
    labels.add(key);
    if (v.label.length > CATALOG_LIMITS.labelMax) out.push(`Keep option names under ${CATALOG_LIMITS.labelMax} letters.`);
  }
  return [...new Set(out)];
}
