"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Handshake, Mail, MessageCircle, Send, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/Button";
import { Chip, type ChipTone } from "@/components/Chip";
import { DraftPanel } from "@/components/outreach/LeadCard";
import { DealForm } from "./DealForm";
import { activeVariants, entryName, type CatalogItem } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { categoryLabel, dealText, PARTNER_STAGES, type Lead, type PartnerStage } from "@/lib/outreach";
import { draftOutreachEmail, findLeadEmail, partnersChanged, setNotInterested, setPartnerStage, updateLead, type LeadChanges, type Transaction } from "@/lib/store";

/** Stage pill colors: blue = replied and waiting on the owner, mint = a deal. */
const stageTone: Record<PartnerStage, ChipTone> = { found: "neutral", emailed: "neutral", replied: "sky", deal: "mint" };

const dayName = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/**
 * One business in the pipeline, with the next thing to do:
 * found = Draft email · emailed = days since, follow-up date, Draft follow-up ·
 * replied = Help me reply · deal = the terms, visits and $ earned.
 * The owner moves it along by hand. Second never sends anything.
 */
export function PartnerCard({
  lead,
  catalog,
  income,
  onChange,
  onGone,
  autoDraft,
}: {
  lead: Lead;
  catalog: CatalogItem[];
  /** Money entries tagged with this partner */
  income: Transaction[];
  onChange: (lead: Lead) => void;
  /** Marked "not interested" (or brought back) */
  onGone?: (id: string) => void;
  /** Opened from Home's "Draft email": start drafting straight away */
  autoDraft?: boolean;
}) {
  const stage = lead.stage ?? "found";
  const [busy, setBusy] = useState<"draft" | "stage" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const started = useRef(false);
  const [now] = useState(() => Date.now());

  async function draft(followUp = false) {
    setBusy("draft");
    setMessage(null);
    // Email lookups only happen here, when the owner asks for a draft for this business.
    const [found, drafted] = await Promise.all([
      lead.email ? Promise.resolve(null) : findLeadEmail(lead.id),
      draftOutreachEmail(lead.id, (lead.idea?.dealIdea ?? "").slice(0, 400), followUp),
    ]);
    setBusy(null);
    if (!drafted.ok) return setMessage(drafted.message);
    const email = found && found.ok ? found.lead.email : lead.email;
    const emailSource = found && found.ok ? found.lead.emailSource : lead.emailSource;
    onChange({ ...drafted.lead, email, emailSource, idea: lead.idea, stage, deal: lead.deal });
    setDraftOpen(true);
    if (found && found.ok && !found.found) setMessage("Second couldn't find a public email. You can still copy the draft and send it through their website or Instagram.");
  }
  // Opened from Home's "Draft email": start once, after the card is on screen.
  useEffect(() => {
    if (!autoDraft || started.current || stage !== "found" || lead.draftBody) return;
    started.current = true;
    queueMicrotask(() => void draft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDraft]);

  async function move(next: PartnerStage) {
    setBusy("stage");
    const ok = await setPartnerStage(lead.id, next);
    setBusy(null);
    if (!ok) return setMessage("We couldn't save that. Please try again.");
    partnersChanged();
    const now = new Date().toISOString();
    onChange({ ...lead, stage: next, ...(next === "emailed" ? { emailedAt: now, status: "contacted" } : next === "replied" ? { repliedAt: now, status: "replied" } : {}) });
    setDraftOpen(false);
  }

  // DraftPanel's "I sent it" = Mark as emailed.
  const saveDraft = async (changes: LeadChanges) => {
    if (changes.status === "contacted") return void move("emailed");
    onChange({ ...lead, ...changes });
    if (!(await updateLead(lead.id, changes))) setMessage("We couldn't save that. Please try again.");
  };

  const days = lead.emailedAt ? Math.max(0, Math.floor((now - Date.parse(lead.emailedAt)) / 86_400_000)) : null;
  const dealOption = lead.deal?.variantId
    ? catalog.flatMap((i) => activeVariants(i).map((v) => ({ v, name: entryName(i, v, activeVariants(i).length) }))).find((x) => x.v.id === lead.deal?.variantId)?.name
    : null;
  const earned = income.reduce((s, t) => s + t.amount, 0);
  const details = [categoryLabel(lead.category), lead.distanceMi != null ? `${lead.distanceMi} mi` : null, lead.town].filter(Boolean).join(" · ");

  return (
    <article aria-label={lead.name} className="flex flex-col gap-3 rounded-card border border-line bg-card p-[18px] text-ink">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-[16px] leading-snug font-semibold break-words">{lead.name}</h3>
          {details && <p className="m-0 mt-0.5 text-sm text-muted">{details}</p>}
        </div>
        <Chip tone={stageTone[stage]} size="sm">
          {PARTNER_STAGES.find((s) => s.id === stage)?.label}
        </Chip>
      </div>

      {stage === "found" && lead.idea && <p className="m-0 line-clamp-3 text-sm text-ink-soft">{lead.idea.dealIdea}</p>}
      {lead.email && (
        <p className="m-0 flex items-center gap-1.5 text-sm text-muted">
          <Mail size={14} aria-hidden="true" /> <span className="break-all">{lead.email}</span>
        </p>
      )}

      {stage === "emailed" && (
        <p className="m-0 text-sm text-ink-soft">
          Emailed {days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}
          {lead.followUpOn ? ` · follow up ${dayName(lead.followUpOn)}` : ""}
        </p>
      )}
      {stage === "replied" && <p className="m-0 text-sm text-sky-ink">They replied. Paste their message in chat and Second will help you answer.</p>}
      {stage === "deal" && (
        <div className="flex flex-col gap-1 rounded-row bg-mint-tint px-3 py-2.5 text-mint-heading">
          <span className="text-sm font-semibold">{dealText(lead.deal, dealOption) || "Deal"}</span>
          {lead.deal?.note && lead.deal.type !== "custom" && <span className="text-sm">{lead.deal.note}</span>}
          <span className="text-sm">
            {income.length} {income.length === 1 ? "visit" : "visits"} · {formatMoney(earned)} earned
          </span>
        </div>
      )}

      {message && (
        <p role="status" className="m-0 rounded-row bg-paper px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {dealOpen ? (
        <DealForm
          lead={lead}
          catalog={catalog}
          onDone={(deal) => {
            setDealOpen(false);
            if (deal) {
              onChange({ ...lead, deal, stage: "deal" });
              partnersChanged();
            }
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {stage === "found" &&
            (lead.draftBody ? (
              <>
                <Button size="sm" variant={draftOpen ? "soft" : "primary"} weight={draftOpen ? "medium" : "semibold"} onClick={() => setDraftOpen((o) => !o)}>
                  {draftOpen ? "Hide draft" : "View draft"}
                </Button>
                <Button size="sm" variant="green" icon={<Send size={15} aria-hidden="true" />} onClick={() => move("emailed")} disabled={busy !== null}>
                  Mark as emailed
                </Button>
              </>
            ) : (
              <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={() => draft()} disabled={busy !== null}>
                {busy === "draft" ? "Second is writing…" : "Draft email"}
              </Button>
            ))}
          {stage === "emailed" && (
            <>
              <Button size="sm" variant="soft" weight="medium" icon={<Sparkles size={15} aria-hidden="true" />} onClick={() => draft(true)} disabled={busy !== null}>
                {busy === "draft" ? "Second is writing…" : "Draft follow-up"}
              </Button>
              <Button size="sm" onClick={() => move("replied")} disabled={busy !== null}>
                They replied
              </Button>
            </>
          )}
          {stage === "replied" && (
            <>
              <Button size="sm" href={`/chat?reply=${encodeURIComponent(lead.id)}`} icon={<MessageCircle size={15} aria-hidden="true" />}>
                Help me reply
              </Button>
              <Button size="sm" variant="green" icon={<Handshake size={15} aria-hidden="true" />} onClick={() => setDealOpen(true)}>
                We made a deal
              </Button>
            </>
          )}
          {stage === "deal" && (
            <Button size="sm" variant="soft" weight="medium" onClick={() => setDealOpen(true)}>
              Edit deal
            </Button>
          )}
          {stage !== "deal" && (
            <button
              type="button"
              onClick={async () => {
                if (await setNotInterested(lead.id, true)) {
                  onGone?.(lead.id);
                  partnersChanged();
                }
              }}
              className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-sm text-muted hover:bg-line-soft hover:text-ink"
            >
              <Ban size={14} aria-hidden="true" /> Not interested
            </button>
          )}
        </div>
      )}

      {draftOpen && lead.draftBody && <DraftPanel lead={lead} onSave={saveDraft} onRedo={() => draft(stage === "emailed")} redoDisabled={busy !== null} />}
    </article>
  );
}

/** A business marked "Not interested": bring it back to Found. */
export function NotInterestedRow({ lead, onBack }: { lead: Lead; onBack: (id: string) => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-row border border-line-soft bg-card px-3.5 py-2 text-ink">
      <span className="text-[15px]">{lead.name}</span>
      <button
        type="button"
        onClick={async () => {
          if (await setNotInterested(lead.id, false)) {
            onBack(lead.id);
            partnersChanged();
          }
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-sky-ink hover:bg-line-soft"
      >
        <Undo2 size={14} aria-hidden="true" /> Bring back
      </button>
    </li>
  );
}

