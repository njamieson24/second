"use client";

import { useState } from "react";
import { AtSign, Check, ChevronDown, ChevronUp, Copy, Globe, Mail, Phone, Search, Send, Sparkles, StickyNote, X } from "lucide-react";
import { Button } from "@/components/Button";
import { inputClass } from "@/components/Field";
import { categoryLabel, LEAD_STATUSES, mailtoLink, OUTREACH_LIMITS, type Lead, type LeadStatus } from "@/lib/outreach";
import { draftOutreachEmail, findLeadEmail, removeFromOutreach, updateLead, type LeadChanges } from "@/lib/store";

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

/**
 * One saved business: name and status, Second's idea from chat, contact details, and one row
 * of actions (Draft email / View draft, Find email, note, Remove). The draft and the note only
 * open when asked, so a long list stays easy to scan.
 */
export function LeadCard({
  lead,
  showDistance,
  onChange,
  onRemoved,
  onUsage,
}: {
  lead: Lead;
  /** Show "2.3 mi away" (in search results) */
  showDistance?: boolean;
  onChange: (lead: Lead) => void;
  /** Called after "Remove" (it's taken off the Outreach list) */
  onRemoved?: (id: string) => void;
  /** Called with the server's "left today" numbers after a lookup or draft */
  onUsage?: (u: { lookupsLeft: number; draftsLeft: number }) => void;
}) {
  const [busy, setBusy] = useState<"email" | "draft" | "remove" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(lead.note ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function save(changes: LeadChanges) {
    onChange({ ...lead, ...changes });
    if (!(await updateLead(lead.id, changes))) setMessage("We couldn't save that. Please try again.");
  }

  function saveNote() {
    const next = note.trim();
    if (next !== (lead.note ?? "")) void save({ note: next || null });
    setNoteOpen(false);
  }

  async function findEmail() {
    setBusy("email");
    setMessage(null);
    const r = await findLeadEmail(lead.id);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    onChange({ ...r.lead, idea: lead.idea });
    onUsage?.(r.usage);
    if (!r.found) setMessage(r.message ?? "No public email found. Try their contact page or Instagram.");
  }

  async function draft() {
    setBusy("draft");
    setMessage(null);
    // Second's idea from chat is the goal for the email.
    const r = await draftOutreachEmail(lead.id, (lead.idea?.dealIdea ?? "").slice(0, OUTREACH_LIMITS.goalMaxChars));
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    onChange({ ...r.lead, idea: lead.idea });
    onUsage?.(r.usage);
    setDraftOpen(true);
  }

  async function remove() {
    setBusy("remove");
    const ok = await removeFromOutreach(lead.id);
    setBusy(null);
    if (!ok) return setMessage("We couldn't remove that. Please try again.");
    onRemoved?.(lead.id);
  }

  const distance = showDistance && lead.distanceMi != null ? `${lead.distanceMi < 0.1 ? "less than 0.1" : lead.distanceMi} mi away` : null;
  const details = [categoryLabel(lead.category), lead.address ?? lead.town, distance].filter(Boolean).join(" · ");
  const hasDraft = Boolean(lead.draftBody);

  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-card p-[22px]" aria-label={lead.name}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <h3 className="m-0 text-[17px] font-semibold break-words">{lead.name}</h3>
          {details && <p className="m-0 mt-0.5 text-sm text-muted">{details}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <span>Status</span>
          <select
            className="min-h-11 rounded-full border border-line-strong bg-card py-0 pr-8 pl-3.5 text-sm font-medium text-ink focus:border-sky"
            value={lead.status}
            onChange={(e) => save({ status: e.target.value as LeadStatus })}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {lead.idea && (
        <div className="flex flex-col gap-1.5 rounded-row bg-mint-tint px-4 py-3 text-[15px] leading-normal text-mint-heading">
          <p className="m-0">
            <span className="font-semibold">The idea: </span>
            {lead.idea.dealIdea}
          </p>
          <p className="m-0 text-sm">
            <span className="font-semibold">Why it works: </span>
            {lead.idea.why}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-0">
        {lead.email && (
          <span className="inline-flex min-h-11 flex-wrap items-center gap-x-1.5 text-[15px]">
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
          </span>
        )}
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

      {lead.note && !noteOpen && (
        <p className="m-0 flex items-start gap-2 text-[15px] text-ink-soft">
          <StickyNote size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
          <span>{lead.note}</span>
        </p>
      )}

      {message && (
        <p role="status" className="m-0 rounded-row bg-paper px-4 py-3 text-[15px] text-ink">
          {message}
        </p>
      )}

      {confirmRemove ? (
        <div role="group" aria-label="Remove this business?" className="flex flex-col gap-2.5 rounded-row bg-paper px-4 py-3">
          <p className="m-0 text-[15px]">
            Remove <span className="font-semibold">{lead.name}</span> from your Outreach list?
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="dark" onClick={remove} disabled={busy !== null}>
              {busy === "remove" ? "Removing…" : "Remove"}
            </Button>
            <Button size="sm" variant="soft" weight="medium" onClick={() => setConfirmRemove(false)} disabled={busy !== null}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          {hasDraft ? (
            <Button
              size="sm"
              variant={draftOpen ? "soft" : "primary"}
              weight={draftOpen ? "medium" : "semibold"}
              icon={draftOpen ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              onClick={() => setDraftOpen((o) => !o)}
            >
              {draftOpen ? "Hide draft" : "View draft"}
            </Button>
          ) : (
            <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={draft} disabled={busy !== null}>
              {busy === "draft" ? "Second is writing…" : "Draft email"}
            </Button>
          )}
          {!lead.email && (
            <Button size="sm" variant="soft" weight="medium" icon={<Search size={15} aria-hidden="true" />} onClick={findEmail} disabled={busy !== null}>
              {busy === "email" ? "Looking for their email…" : "Find email"}
            </Button>
          )}
          {!noteOpen && (
            <Button size="sm" variant="soft" weight="medium" icon={<StickyNote size={15} aria-hidden="true" />} onClick={() => setNoteOpen(true)}>
              {lead.note ? "Edit note" : "Add note"}
            </Button>
          )}
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted hover:bg-line-soft hover:text-ink"
          >
            <X size={15} aria-hidden="true" /> Remove
          </button>
        </div>
      )}

      {noteOpen && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Note (only you see this)
            <input
              className={inputClass}
              value={note}
              maxLength={OUTREACH_LIMITS.noteMaxChars}
              placeholder="Like: call back in May"
              autoFocus
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNote()}
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveNote}>
              Save note
            </Button>
            <Button
              size="sm"
              variant="soft"
              weight="medium"
              onClick={() => {
                setNote(lead.note ?? "");
                setNoteOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {hasDraft && draftOpen && <DraftPanel lead={lead} onSave={save} onRedo={draft} redoDisabled={busy !== null} />}
    </article>
  );
}

/** The draft: editable subject and body, open in their own email app, Copy, Mark as sent. */
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
          className={`${inputClass} field-sizing-content max-h-[420px] min-h-40 py-3 leading-normal`}
          value={body}
          maxLength={3000}
          onChange={(e) => setBody(e.target.value)}
          onBlur={saveEdits}
        />
      </label>
      {copyProblem && <p className="m-0 text-sm text-ink">Your browser blocked copying. Select the text and copy it yourself.</p>}
      <div className="flex flex-wrap gap-2">
        <a
          href={mailtoLink(lead.email, subject, body)}
          onClick={saveEdits}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sky px-[18px] text-sm font-semibold text-on-sky no-underline transition-colors hover:bg-sky-ink"
        >
          <Mail size={15} aria-hidden="true" /> Open in my email app
        </a>
        <Button size="sm" variant="soft" weight="medium" icon={copyIcon("body")} onClick={() => copy("body")}>
          {copied === "body" ? "Copied" : "Copy email"}
        </Button>
        <Button size="sm" variant="soft" weight="medium" icon={copyIcon("subject")} onClick={() => copy("subject")}>
          {copied === "subject" ? "Copied" : "Copy subject"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
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
