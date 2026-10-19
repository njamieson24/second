// The catalog on the SERVER: the AI routes (chat, This Week, content, outreach, notes) read
// prices from here, the one source of truth. Never import into a "use client" file.

import type { SupabaseClient } from "@supabase/supabase-js";
import { servicesFromCatalog, type CatalogItem } from "./catalog";
import { toCatalog, type CatalogItemRow, type CatalogVariantRow } from "./db-rows";
import type { Business } from "./store";

/** Everything this owner sells (read AS the owner). Empty before catalog.sql runs. */
export async function loadCatalog(db: SupabaseClient, userId: string): Promise<CatalogItem[]> {
  const [items, variants] = await Promise.all([
    db.from("catalog_items").select("*").eq("user_id", userId),
    db.from("catalog_variants").select("*").eq("user_id", userId),
  ]);
  if (items.error || variants.error) return [];
  return toCatalog((items.data ?? []) as CatalogItemRow[], (variants.data ?? []) as CatalogVariantRow[]);
}

/** The business with `services` filled in from the catalog (never from businesses.services). */
export async function withCatalog<B extends Business | null>(db: SupabaseClient, userId: string, business: B): Promise<B> {
  if (!business) return business;
  const catalog = await loadCatalog(db, userId);
  return { ...business, services: servicesFromCatalog(catalog) };
}
