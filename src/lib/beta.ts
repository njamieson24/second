// The beta sign-up form's fields and rules. Used by the /beta page (to show
// problems right away) and by the server route (to check again before saving).
// The database has the same limits too (supabase/beta.sql).

import { businessTypes, type BusinessType } from "./business-types";

export type BetaStage = "running" | "starting" | "curious";

export type BetaSignup = {
  name: string;
  email: string;
  businessName: string;
  businessType: BusinessType | "";
  town: string;
  stage: BetaStage | "";
};

export const BETA_LIMITS = { name: 100, email: 254, businessName: 120, town: 100 } as const;

export const BETA_STAGES: { id: BetaStage; label: string }[] = [
  { id: "running", label: "I run a business" },
  { id: "starting", label: "I'm about to start one" },
  { id: "curious", label: "Just curious" },
];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type BetaProblems = Partial<Record<keyof BetaSignup, string>>;

/** Plain-English problems, by field. Empty when everything is fine. */
export function checkBetaSignup(s: BetaSignup): BetaProblems {
  const problems: BetaProblems = {};
  const name = s.name.trim();
  const email = s.email.trim();
  const town = s.town.trim();
  if (!name) problems.name = "Please tell us your name.";
  else if (name.length > BETA_LIMITS.name) problems.name = `Please keep your name under ${BETA_LIMITS.name} letters.`;
  if (!email) problems.email = "Please add your email so we can reach you.";
  else if (email.length > BETA_LIMITS.email || !EMAIL.test(email))
    problems.email = "That email doesn't look quite right. It should look like name@example.com.";
  if (s.businessName.trim().length > BETA_LIMITS.businessName)
    problems.businessName = `Please keep the business name under ${BETA_LIMITS.businessName} letters.`;
  if (!businessTypes.some((t) => t.id === s.businessType)) problems.businessType = "Please pick the closest type of business.";
  if (!town) problems.town = "Please tell us your town.";
  else if (town.length > BETA_LIMITS.town) problems.town = `Please keep the town under ${BETA_LIMITS.town} letters.`;
  if (!BETA_STAGES.some((st) => st.id === s.stage)) problems.stage = "Please pick the one that fits you best.";
  return problems;
}
