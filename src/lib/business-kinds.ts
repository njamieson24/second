// Kinds of business: one config, not separate apps. Each business type belongs to a family,
// and the family decides the words the app uses (client or customer, session or order,
// service or menu item), what a catalog item's options are (length or size), and how money
// is logged by default (each visit, or a daily total).
//
// Part A uses the words. The family's prompts, dashboard numbers and logging style roll out in
// later parts (see CLAUDE.md). Never hard-code massage or appointment wording in a component:
// read it from here.

import type { BusinessType } from "./business-types";

export type Family = "appointment" | "food" | "retail" | "general";

export type FamilyWords = {
  /** "client" / "customer" */
  customer: string;
  customers: string;
  /** One paid visit: "session" / "order" / "sale" */
  visit: string;
  visits: string;
  /** One thing they sell: "service" / "menu item" / "product" */
  item: string;
  items: string;
  /** The catalog page title */
  catalogTitle: string;
  /** What a variant is: "length" / "size" / "option" */
  variantNoun: string;
  /** Example variant labels for the catalog editor */
  variantExamples: string;
  /** Example item for placeholders */
  itemExample: string;
};

export type FamilyConfig = {
  id: Family;
  words: FamilyWords;
  /** Catalog item kind stored in the database */
  itemKind: "service" | "menu_item" | "product";
  /** Variants carry minutes (appointments) */
  usesMinutes: boolean;
  /** Ask "Who was it?" when logging income */
  tracksCustomers: boolean;
  /** How money is logged by default (the owner can change it) */
  defaultLogging: "per_visit" | "daily_total";
};

export const FAMILIES: Record<Family, FamilyConfig> = {
  appointment: {
    id: "appointment",
    words: {
      customer: "client",
      customers: "clients",
      visit: "session",
      visits: "sessions",
      item: "service",
      items: "services",
      catalogTitle: "Services and prices",
      variantNoun: "length",
      variantExamples: "30 min, 60 min, 90 min",
      itemExample: "Haircut",
    },
    itemKind: "service",
    usesMinutes: true,
    tracksCustomers: true,
    defaultLogging: "per_visit",
  },
  food: {
    id: "food",
    words: {
      customer: "customer",
      customers: "customers",
      visit: "order",
      visits: "orders",
      item: "menu item",
      items: "menu items",
      catalogTitle: "Menu and prices",
      variantNoun: "size",
      variantExamples: "Small, Large",
      itemExample: "Latte",
    },
    itemKind: "menu_item",
    usesMinutes: false,
    tracksCustomers: false,
    defaultLogging: "daily_total",
  },
  retail: {
    id: "retail",
    words: {
      customer: "customer",
      customers: "customers",
      visit: "sale",
      visits: "sales",
      item: "product",
      items: "products",
      catalogTitle: "Products and prices",
      variantNoun: "option",
      variantExamples: "Small, Medium, Large",
      itemExample: "Candle",
    },
    itemKind: "product",
    usesMinutes: false,
    tracksCustomers: false,
    defaultLogging: "daily_total",
  },
  general: {
    id: "general",
    words: {
      customer: "customer",
      customers: "customers",
      visit: "sale",
      visits: "sales",
      item: "item",
      items: "items",
      catalogTitle: "What you sell",
      variantNoun: "option",
      variantExamples: "Basic, Deluxe",
      itemExample: "Item",
    },
    itemKind: "service",
    usesMinutes: false,
    tracksCustomers: true,
    defaultLogging: "per_visit",
  },
};

/**
 * Which family each business type belongs to. Part C adds the full onboarding list (tattoo,
 * pet care, lessons, café, bakery, pizza, restaurant, retail...); unknown types fall back to general.
 */
const TYPE_FAMILY: Record<string, Family> = {
  massage: "appointment",
  beauty: "appointment",
  fitness: "appointment",
  photo: "appointment",
  home: "appointment",
  tattoo: "appointment",
  pet: "appointment",
  lessons: "appointment",
  food: "food",
  cafe: "food",
  bakery: "food",
  pizza: "food",
  catering: "food",
  restaurant: "food",
  retail: "retail",
  other: "general",
};

export function familyOf(type: BusinessType | string | null | undefined): FamilyConfig {
  return FAMILIES[(type && TYPE_FAMILY[type]) || "general"];
}

/** The words for a business type. */
export const wordsFor = (type: BusinessType | string | null | undefined): FamilyWords => familyOf(type).words;

/** "Session" from "session" */
export const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
