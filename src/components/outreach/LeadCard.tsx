"use client";

import { useState } from "react";
import { AtSign, Check, Copy, Globe, Mail, Phone, Search, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { Chip, type ChipTone } from "@/components/Chip";
import { inputClass } from "@/components/Field";
import { categoryLabel, LEAD_STATUSES, mailtoLink, OUTREACH_LIMITS, type Lead, type LeadStatus } from "@/lib/outreach";
import { draftOutreachEmail, findLeadEmail, updateLead, type LeadChanges } from "@/lib/store";

const statusTone: Record<LeadStatus, ChipTone> = {
  new: "neutral",
  email_found: "sky",
  drafted: "sky",
  contacted: "sky",
  replied: "mint",
  not_interested: "neutral",
};
export const statusLabel = (s: LeadStatus) => LEAD_STATUSES.find((x) => x.id === s)?.label ?? s;

const linkClass = "inline-flex min-h-11 items-center gap-1.5 text-[15px] text-sky-ink underline";
const sourceText = (source: string) => {
  if (source === "openstreetmap") return "OpenStreetMap";
  if (source === "added by you") return "added by you";
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source;
  }
};

/** One business: details, status, Find email, Draft email, the draft, and a note. */
export function LeadCard({
  lead,
  showDistance,
  onChange,
  onUsage,
}: {
  lead: Lead;
  /** Show "2.3 mi away" (in search results) */
  showDistance?: boolean;
  onChange: (lead: Lead) => void;
  /** Called with the server's "left today" numbers after a lookup or draft */
  onUsage: (u: { lookupsLeft: number; draftsLeft: number }) => void;
}) {
  const [busy, setBusy] = useState<"email" | "draft" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState(lead.note ?? "");

  async function save(changes: LeadChanges) {
    onChange({ ...lead, ...changes });
    if (!(await updateLead(lead.id, changes))) setMessage("We couldn't save that. Please try again.");
  }

  // A typed note is saved on its own (Enter or leaving the box) and with any status change.
  const noteChange = () => (note.trim() !== (lead.note ?? "") ? { note: note.trim() || null } : {});
  const saveNote = () => {
    const c = noteChange();
    if ("note" in c) save(c);
  };

  async function findEmail() {
    setBusy("email");
    setMessage(null);
    const r = await findLeadEmail(lead.id);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    onChange(r.lead);
    onUsage(r.usage);
    if (!r.found) setMessage(r.message ?? "No public email found. Try their contact page or Instagram.");
  }

  async function draft() {
    setBusy("draft");
    setMessage(null);
    const r = await draftOutreachEmail(lead.id, goal);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setGoalOpen(false);
    onChange(r.lead);
    onUsage(r.usage);
  }

  const distance = showDistance && lead.distanceMi != null ? `${lead.distanceMi < 0.1 ? "less than 0.1" : lead.distanceMi} mi away` : null;
  const details = [categoryLabel(lead.category), lead.address ?? lead.town, distance].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-card p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <h3 className="m-0 text-[17px] font-semibold break-words">{lead.name}</h3>
          {details && <p className="m-0 mt-0.5 text-sm text-muted">{details}</p>}
        </div>
        <Chip tone={statusTone[lead.status]}>{statusLabel(lead.status)}</Chip>
      </div>

      <div className="flex flex-wrap gap-x-4">
        {lead.website && (
          <a href={lead.website} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <Globe size={16} aria-hidden="true" /> Website
          </a>
        )}
        {lead.phone && (
          <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
            <Phone size={16} aria-hidden="true" /> {lead.phone}
          </a>
        )}
        {lead.instagram && (
          <a href={lead.instagram} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <AtSign size={16} aria-hidden="true" /> Instagram
          </a>
        )}
        {lead.contactPage && !lead.email && (
          <a href={lead.contactPage} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Contact page
          </a>
        )}
      </div>

      {lead.email ? (
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-[15px]">
          <Mail size={16} aria-hidden="true" className="text-muted" />
          <span className="font-medium break-all">{lead.email}</span>
          {lead.emailSource && (
            <span className="text-sm text-muted">
              (found on{" "}
              {/^https?:\/\//.test(lead.emailSource) ? (
                <a href={lead.emailSource} target="_blank" rel="noopener noreferrer" className="text-sky-ink underline">
                  {sourceText(lead.emailSource)}
                </a>
              ) : (
                sourceText(lead.emailSource)
              )}
              )
            </span>
          )}
        </p>
      ) : null}

      {message && (
        <p role="status" className="m-0 rounded-row bg-paper px-4 py-3 text-[15px] text-ink">
          {message}
        </p>
      )}

      {!lead.draftBody && (
        <div className="flex flex-wrap gap-2.5">
          {!lead.email && (
            <Button size="sm" variant="soft" weight="medium" icon={<Search size={15} aria-hidden="true" />} onClick={findEmail} disabled={busy !== null}>
              {busy === "email" ? "Checking their website…" : lead.emailCheckedAt ? "Look again" : "Find email"}
            </Button>
          )}
          {!goalOpen && (
            <Button size="sm" variant="primary" icon={<Sparkles size={15} aria-hidden="true" />} onClick={() => setGoalOpen(true)} disabled={busy !== null}>
              Draft email
            </Button>
          )}
        </div>
      )}

      {goalOpen && (
        <GoalBox goal={goal} setGoal={setGoal} busy={busy === "draft"} onWrite={draft} onCancel={() => setGoalOpen(false)} />
      )}

      {lead.draftBody && (
        <DraftPanel
          lead={lead}
          onSave={save}
          onRedo={() => setGoalOpen(true)}
          redoDisabled={busy !== null || goalOpen}
        />
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-line-soft pt-3">
        <label className="flex min-w-0 flex-1 basis-60 flex-col gap-1.5 text-sm text-muted">
          Note (only you see this)
          <input
            className={inputClass}
            value={note}
            maxLength={OUTREACH_LIMITS.noteMaxChars}
            placeholder="Like: call back in May"
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            onKeyDown={(e) => e.key === "Enter" && saveNote()}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Status
          <select
            className={`${inputClass} pr-8`}
            value={lead.status}
            onChange={(e) => save({ status: e.target.value as LeadStatus, ...noteChange() })}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}

function GoalBox({ goal, setGoal, busy, onWrite, onCancel }: { goal: string; setGoal: (g: string) => void; busy: boolean; onWrite: () => void; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-row bg-paper p-4">
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        What would you like from them? (optional)
        <input
          className={inputClass}
          value={goal}
          maxLength={OUTREACH_LIMITS.goalMaxChars}
          placeholder="Like: a chair massage day for their members"
          onChange={(e) => setGoal(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={onWrite} disabled={busy}>
          {busy ? "Second is writing…" : "Write it"}
        </Button>
        <Button size="sm" variant="soft" weight="medium" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The draft: editable subject and body, Copy, open in their own email app, Mark as sent. */
export function DraftPanel({ lead, onSave, onRedo, redoDisabled }: { lead: Lead; onSave: (c: LeadChanges) => void; onRedo: () => void; redoDisabled: boolean }) {
  const [subject, setSubject] = useState(lead.draftSubject ?? "");
  const [body, setBody] = useState(lead.draftBody ?? "");
  const [copied, setCopied] = useState<"subject" | "body" | null>(null);
  const [copyProblem, setCopyProblem] = useState(false);
  const [seen, setSeen] = useState({ s: lead.draftSubject, b: lead.draftBody });
  // A new draft from Second replaces what's in the boxes.
  if (seen.s !== lead.draftSubject || seen.b !== lead.draftBody) {
    setSeen({ s: lead.draftSubject, b: lead.draftBody });
    setSubject(lead.draftSubject ?? "");
    setBody(lead.draftBody ?? "");
  }

  async function copy(which: "subject" | "body") {
    try {
      await navigator.clipboard.writeText(which === "subject" ? subject : body);
      setCopied(which);
      setCopyProblem(false);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyProblem(true);
    }
  }
  const saveEdits = () => {
    if (subject !== (lead.draftSubject ?? "") || body !== (lead.draftBody ?? "")) onSave({ draftSubject: subject, draftBody: body });
  };
  const sent = lead.status === "contacted" || lead.status === "replied" || lead.status === "not_interested";
  const copyIcon = (w: "subject" | "body") => (copied === w ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />);

  return (
    <div className="flex flex-col gap-3 rounded-row bg-paper p-4">
      <p className="m-0 text-sm text-muted">Second wrote this. Read it, change anything, then send it from your own email. Second never sends it.</p>
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Subject
        <input className={inputClass} value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} onBlur={saveEdits} />
      </label>
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Email
        <textarea
          className={`${inputClass} py-3 leading-normal`}
          rows={10}
          value={body}
          maxLength={3000}
          onChange={(e) => setBody(e.target.value)}
          onBlur={saveEdits}
        />
      </label>
      {copyProblem && <p className="m-0 text-sm text-ink">Your browser blocked copying. Select the text and copy it yourself.</p>}
      <div className="flex flex-wrap gap-2.5">
        <Button size="sm" variant="soft" weight="medium" icon={copyIcon("subject")} onClick={() => copy("subject")}>
          {copied === "subject" ? "Copied" : "Copy subject"}
        </Button>
        <Button size="sm" variant="soft" weight="medium" icon={copyIcon("body")} onClick={() => copy("body")}>
          {copied === "body" ? "Copied" : "Copy email"}
        </Button>
        <a
          href={mailtoLink(lead.email, subject, body)}
          onClick={saveEdits}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-card px-[18px] text-sm font-medium text-ink no-underline transition-colors hover:border-ink"
        >
          <Mail size={15} aria-hidden="true" /> Open in my email app
        </a>
        {!sent && (
          <Button size="sm" variant="green" icon={<Send size={15} aria-hidden="true" />} onClick={() => onSave({ status: "contacted" })}>
            I sent it
          </Button>
        )}
        <Button size="sm" variant="soft" weight="medium" icon={<Sparkles size={15} aria-hidden="true" />} onClick={onRedo} disabled={redoDisabled}>
          Write a new one
        </Button>
      </div>
    </div>
  );
}
