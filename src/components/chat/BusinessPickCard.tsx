"use client";

import { useState } from "react";
import { Check, Globe, Mail, Phone, Search, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/Button";
import Link from "next/link";
import { DraftPanel } from "@/components/outreach/LeadCard";
import type { BusinessCard } from "@/lib/chat";
import { categoryLabel, OUTREACH_LIMITS, type Lead } from "@/lib/outreach";
import { draftOutreachEmail, findLeadEmail, saveLeadToOutreach, updateLead } from "@/lib/store";

const linkClass = "inline-flex min-h-11 items-center gap-1.5 text-[15px] text-sky-ink underline";

function sourceText(source: string) {
  if (source === "openstreetmap") return "OpenStreetMap";
  if (source === "added by you") return "added by you";
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return "the web";
  }
}

/**
 * One business Second picked: why, a deal idea, the next step, its public email if found, and
 * Find email / Draft email / Save to Outreach. Everything shown comes from the map and the
 * server's checks. Nothing is sent: drafts are copied or opened in the owner's own email app.
 */
export function BusinessPickCard({ card, onChange }: { card: BusinessCard; onChange: (card: BusinessCard) => void }) {
  const [busy, setBusy] = useState<"email" | "draft" | "save" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  async function findEmail() {
    setBusy("email");
    setMessage(null);
    const r = await findLeadEmail(card.leadId);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    onChange({ ...card, email: r.lead.email, emailSource: r.lead.emailSource, website: r.lead.website ?? card.website });
    if (!r.found) setMessage(r.message ?? "No public email found. Try their contact page or Instagram.");
  }

  async function draft() {
    setBusy("draft");
    setMessage(null);
    const r = await draftOutreachEmail(card.leadId, card.dealIdea.slice(0, OUTREACH_LIMITS.goalMaxChars));
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setLead(r.lead);
  }

  async function save() {
    setBusy("save");
    setMessage(null);
    const r = await saveLeadToOutreach(card.leadId);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setSavedNote(r.already ? "Already in your Outreach list" : "Saved to Outreach");
    onChange({ ...card, saved: true });
  }

  const details = [categoryLabel(card.category), card.distanceMi != null ? `${card.distanceMi} mi away` : null, card.address ?? card.town].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col gap-3 rounded-row border border-line bg-card px-4 py-3.5 text-ink" aria-label={`Business pick: ${card.name}`}>
      <div>
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-sky-ink">
          <Star size={14} aria-hidden="true" /> Second&apos;s pick
        </div>
        <h3 className="m-0 mt-1 text-[17px] font-semibold break-words">{card.name}</h3>
        {details && <p className="m-0 mt-0.5 text-sm text-muted">{details}</p>}
      </div>

      <div className="flex flex-col gap-2 text-[15px] leading-normal">
        <p className="m-0">
          <span className="font-semibold">Why it works: </span>
          {card.why}
        </p>
        <p className="m-0 rounded-row bg-mint-tint px-3 py-2 text-mint-heading">
          <span className="font-semibold">The idea: </span>
          {card.dealIdea}
        </p>
        <p className="m-0 text-muted">{card.nextStep}</p>
      </div>

      <div className="flex flex-wrap gap-x-4">
        {card.website && (
          <a href={card.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Globe size={16} aria-hidden="true" /> Website
          </a>
        )}
        {card.phone && (
          <a href={`tel:${card.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
            <Phone size={16} aria-hidden="true" /> {card.phone}
          </a>
        )}
      </div>

      {card.email && (
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-[15px]">
          <Mail size={16} aria-hidden="true" className="text-muted" />
          <span className="font-medium break-all">{card.email}</span>
          {card.emailSource && (
            <span className="text-sm text-muted">
              (found on{" "}
              {/^https?:\/\//.test(card.emailSource) ? (
                <a href={card.emailSource} target="_blank" rel="noopener noreferrer" className="text-sky-ink underline">
                  {sourceText(card.emailSource)}
                </a>
              ) : (
                sourceText(card.emailSource)
              )}
              )
            </span>
          )}
        </p>
      )}

      {message && (
        <p role="status" className="m-0 rounded-row bg-paper px-3 py-2 text-[15px]">
          {message}
        </p>
      )}

      {!lead && (
        <div className="flex flex-wrap gap-2">
          {!card.email && (
            <Button size="sm" variant="soft" weight="medium" icon={<Search size={15} aria-hidden="true" />} onClick={findEmail} disabled={busy !== null}>
              {busy === "email" ? "Looking for their email…" : "Find email"}
            </Button>
          )}
          <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={draft} disabled={busy !== null}>
            {busy === "draft" ? "Second is writing…" : "Draft email"}
          </Button>
          {card.saved ? (
            <Link
              href="/outreach"
              className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full bg-mint-tint px-4 text-sm font-semibold text-mint-deep no-underline hover:underline"
            >
              <Check size={14} strokeWidth={2.6} aria-hidden="true" /> {savedNote ?? "In your Outreach list"} · See it
            </Link>
          ) : (
            <Button size="sm" variant="soft" weight="medium" onClick={save} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save to Outreach"}
            </Button>
          )}
        </div>
      )}

      {lead && (
        <DraftPanel
          lead={lead}
          onSave={(changes) => {
            setLead({ ...lead, ...changes });
            void updateLead(lead.id, changes);
          }}
          onRedo={draft}
          redoDisabled={busy !== null}
        />
      )}

      <p className="m-0 text-xs text-muted">
        Business details from{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-sky-ink underline">
          © OpenStreetMap contributors
        </a>
      </p>
    </article>
  );
}
