// What Second knows about each kind of business. Used by onboarding,
// the roadmap (license wording), and the money plan (starting numbers).

export type BusinessType = "massage" | "food" | "fitness" | "beauty" | "home" | "photo" | "other";

export type ServiceIdea = { name: string; price: number; minutes?: number };
export type CostIdea = { label: string; amount: number };

export type BusinessTypeInfo = {
  id: BusinessType;
  label: string;
  /** One paid visit, in plain words: "session", "job", "order" */
  unit: string;
  units: string;
  /** Used in "Confirm your ... and insurance" */
  license: string;
  services: ServiceIdea[];
  /** Sample local price range for the main service (not real market data yet) */
  priceRange: { min: number; max: number; low: number; high: number };
  monthlyCosts: CostIdea[];
  startupCosts: CostIdea[];
};

const genericMonthly: CostIdea[] = [
  { label: "Supplies", amount: 80 },
  { label: "Liability insurance", amount: 30 },
  { label: "Booking and payment app", amount: 30 },
  { label: "Marketing", amount: 100 },
  { label: "Phone and extras", amount: 40 },
];

const genericStartup: CostIdea[] = [
  { label: "Equipment", amount: 500 },
  { label: "First supplies", amount: 200 },
  { label: "Insurance, first year", amount: 350 },
  { label: "Business cards", amount: 100 },
  { label: "Logo and website", amount: 0 },
  { label: "One month cushion", amount: 600 },
];

export const businessTypes: BusinessTypeInfo[] = [
  {
    id: "massage",
    label: "Massage and wellness",
    unit: "session",
    units: "sessions",
    license: "massage license",
    services: [
      { name: "Swedish massage", price: 95, minutes: 60 },
      { name: "Deep tissue", price: 110, minutes: 60 },
      { name: "Prenatal massage", price: 100, minutes: 60 },
      { name: "Sports massage", price: 110, minutes: 60 },
      { name: "Chair massage event", price: 250, minutes: 120 },
    ],
    priceRange: { min: 70, max: 140, low: 80, high: 120 },
    monthlyCosts: [
      { label: "Table and supplies", amount: 60 },
      { label: "Liability insurance", amount: 25 },
      { label: "Booking app", amount: 30 },
      { label: "Marketing", amount: 100 },
      { label: "Phone and extras", amount: 40 },
    ],
    startupCosts: [
      { label: "Massage table", amount: 600 },
      { label: "Linens and oils", amount: 250 },
      { label: "Insurance, first year", amount: 300 },
      { label: "Business cards", amount: 100 },
      { label: "Logo and website", amount: 0 },
      { label: "One month cushion", amount: 600 },
    ],
  },
  {
    id: "food",
    label: "Food and catering",
    unit: "order",
    units: "orders",
    license: "food permit and kitchen rules",
    services: [
      { name: "Drop-off catering", price: 350 },
      { name: "Party trays", price: 120 },
      { name: "Weekly meal prep", price: 150 },
      { name: "Custom cakes", price: 90 },
    ],
    priceRange: { min: 80, max: 600, low: 150, high: 450 },
    monthlyCosts: [
      { label: "Ingredients", amount: 400 },
      { label: "Kitchen rental", amount: 300 },
      { label: "Packaging", amount: 80 },
      { label: "Liability insurance", amount: 40 },
      { label: "Marketing", amount: 100 },
    ],
    startupCosts: [
      { label: "Pans and equipment", amount: 800 },
      { label: "Food permit", amount: 150 },
      { label: "Insurance, first year", amount: 450 },
      { label: "Business cards", amount: 100 },
      { label: "Logo and website", amount: 0 },
      { label: "One month cushion", amount: 800 },
    ],
  },
  {
    id: "fitness",
    label: "Personal training",
    unit: "session",
    units: "sessions",
    license: "trainer certification",
    services: [
      { name: "One-on-one training", price: 75, minutes: 60 },
      { name: "Small group class", price: 25, minutes: 45 },
      { name: "Starter assessment", price: 50, minutes: 45 },
    ],
    priceRange: { min: 40, max: 130, low: 60, high: 100 },
    monthlyCosts: genericMonthly,
    startupCosts: genericStartup,
  },
  {
    id: "beauty",
    label: "Hair and beauty",
    unit: "appointment",
    units: "appointments",
    license: "cosmetology license",
    services: [
      { name: "Haircut", price: 55, minutes: 45 },
      { name: "Color", price: 120, minutes: 120 },
      { name: "Blowout", price: 45, minutes: 45 },
      { name: "Nails", price: 40, minutes: 45 },
    ],
    priceRange: { min: 30, max: 110, low: 45, high: 85 },
    monthlyCosts: genericMonthly,
    startupCosts: genericStartup,
  },
  {
    id: "home",
    label: "Cleaning and home services",
    unit: "job",
    units: "jobs",
    license: "local business license",
    services: [
      { name: "Standard cleaning", price: 140, minutes: 180 },
      { name: "Deep cleaning", price: 260, minutes: 300 },
      { name: "Move-out cleaning", price: 300, minutes: 360 },
    ],
    priceRange: { min: 90, max: 250, low: 120, high: 200 },
    monthlyCosts: genericMonthly,
    startupCosts: genericStartup,
  },
  {
    id: "photo",
    label: "Photography",
    unit: "shoot",
    units: "shoots",
    license: "local business license",
    services: [
      { name: "Family portraits", price: 250, minutes: 60 },
      { name: "Headshots", price: 150, minutes: 30 },
      { name: "Event coverage", price: 600, minutes: 240 },
    ],
    priceRange: { min: 100, max: 500, low: 175, high: 350 },
    monthlyCosts: genericMonthly,
    startupCosts: genericStartup,
  },
  {
    id: "other",
    label: "Something else",
    unit: "booking",
    units: "bookings",
    license: "local business license",
    services: [],
    priceRange: { min: 40, max: 200, low: 60, high: 140 },
    monthlyCosts: genericMonthly,
    startupCosts: genericStartup,
  },
];

export function getBusinessType(id: BusinessType): BusinessTypeInfo {
  return businessTypes.find((t) => t.id === id) ?? businessTypes[businessTypes.length - 1];
}
