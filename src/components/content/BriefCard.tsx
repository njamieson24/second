"use client";

import { useState } from "react";
import { Camera, Check, Clapperboard, Copy, GalleryHorizontal, Pencil, Send, Sparkles, Undo2, type LucideIcon } from "lucide-react";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { inputClass } from "../Field";
import { copyText, HOOK_MAX_CHARS, POST_FORMAT_LABELS, POST_STATUS_LABELS, POST_TYPE_LABELS, type ContentPost, type PostFormat } from "@/lib/content";
import { dayLabel } from "@/lib/dates";
import { saveContentHook, updateContentPost, writeContentCaption } from "@/lib/store";

const FORMAT_ICONS: Record<PostFormat, LucideIcon> = { photo: Camera, carousel: GalleryHorizontal, reel: Clapperboard };
const statusTone = (s: ContentPost["status"]) => (s === "posted" || s === "ready" ? "mint" : s === "drafted" ? "sky" : "neutral");

/** One creative brief: what to post, format, shots, hook, best day; plus caption, Copy and Mark as posted. */
export function BriefCard({ post, highlighted, onChange }: { post: ContentPost; highlighted?: boolean; onChange: (changes: Partial<ContentPost>) => void }) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [hookDraft, setHookDraft] = useState(post.hook ?? "");
  const [editingHook, setEditingHook] = useState(false);
  const [busy, setBusy] = useState<"write" | "save" | "hook" | "status" | "move" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(false);
  const FormatIcon = post.format ? FORMAT_ICONS[post.format] : null;
  const posted = post.status === "posted";
  const captionChanged = caption !== (post.caption ?? "");

  async function write() {
    setBusy("write");
    setMessage(null);
    const r = await writeContentCaption(post.id);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setCaption(r.caption);
    onChange({ caption: r.caption, status: post.status === "idea" ? "drafted" : post.status });
  }

  async function saveCaption() {
    setBusy("save");
    setMessage(null);
    const status = post.status === "idea" && caption.trim() ? "drafted" : post.status;
    const ok = await updateContentPost(post.id, { caption: caption || null, status });
    setBusy(null);
    if (ok) onChange({ caption: caption || null, status });
    else setMessage("We couldn't save the caption. Please try again.");
  }

  async function saveHook() {
    setBusy("hook");
    setMessage(null);
    const r = await saveContentHook(post.id, hookDraft);
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setHookDraft(r.hook);
    setEditingHook(false);
    onChange({ hook: r.hook });
  }

  async function setStatus(status: ContentPost["status"]) {
    setBusy("status");
    setMessage(null);
    const postedAt = status === "posted" ? new Date().toISOString() : null;
    const ok = await updateContentPost(post.id, { status, postedAt });
    setBusy(null);
    if (ok) onChange({ status, postedAt });
    else setMessage("We couldn't save that. Please try again.");
  }

  async function move(day: string) {
    setBusy("move");
    const ok = await updateContentPost(post.id, { day });
    setBusy(null);
    if (ok) {
      onChange({ day });
      setMoving(false);
    } else setMessage("We couldn't move it. Please try again.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText({ hook: post.hook, caption: caption || null }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Your browser blocked copying. Select the text and copy it yourself.");
    }
  }

  const id = `brief-${post.id}`;
  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className={`flex scroll-mt-24 flex-col gap-3.5 rounded-row bg-ink-2 p-4 desk:p-5 ${highlighted ? "ring-2 ring-panel-accent" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-panel-accent">
          {post.source === "this_week" ? "From This Week · " : ""}
          {POST_TYPE_LABELS[post.type]} · Best day: {dayLabel(post.day, true).split(",")[0]}
        </span>
        <Chip tone={statusTone(post.status)} size="sm">
          {POST_STATUS_LABELS[post.status]}
        </Chip>
      </div>

      <div>
        <h3 id={`${id}-title`} className={`m-0 text-[17px] leading-snug font-semibold ${posted ? "opacity-80" : ""}`}>
          {post.title}
        </h3>
        <p className="mt-0.5 mb-0 text-sm text-muted-dark">{post.why}</p>
      </div>

      {post.format && post.shots ? (
        <>
          <div className="flex items-center gap-2">
            {FormatIcon && <FormatIcon size={17} aria-hidden="true" className="text-panel-accent" />}
            <span className="text-[15px] font-medium">{POST_FORMAT_LABELS[post.format]}</span>
          </div>
          <div>
            <h4 className="m-0 mb-1.5 text-sm font-semibold text-on-dark">How to shoot it</h4>
            <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[15px] leading-normal marker:font-semibold marker:text-panel-accent">
              {post.shots.map((shot, i) => (
                <li key={i}>{shot}</li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <p className="m-0 text-sm text-muted-dark">Made before briefs existed.</p>
      )}

      {/* Hook (editable, checked on save) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-on-dark">{post.format === "reel" ? "Hook (on screen for the first 3 seconds)" : "Hook (first line of the caption)"}</span>
        {editingHook ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-hook`} className="sr-only">
              Edit the hook
            </label>
            <input id={`${id}-hook`} value={hookDraft} maxLength={HOOK_MAX_CHARS} onChange={(e) => setHookDraft(e.target.value)} className={inputClass} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={saveHook} disabled={busy !== null || !hookDraft.trim()}>
                {busy === "hook" ? "Saving…" : "Save hook"}
              </Button>
              <Button
                size="sm"
                variant="ghost-dark"
                weight="medium"
                onClick={() => {
                  setEditingHook(false);
                  setHookDraft(post.hook ?? "");
                  setMessage(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <p className="m-0 flex-1 rounded-row border-l-4 border-panel-accent bg-panel px-3.5 py-2.5 text-base font-medium">
              {post.hook ? `“${post.hook}”` : <span className="font-normal text-muted-dark">No hook yet.</span>}
            </p>
            {!posted && (
              <button
                type="button"
                onClick={() => setEditingHook(true)}
                aria-label={`Edit the hook for: ${post.title}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-dark hover:bg-ink-line"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Caption */}
      {(caption || post.caption) && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-caption`} className="text-sm font-semibold text-on-dark">
            Caption (you can edit it)
          </label>
          <textarea
            id={`${id}-caption`}
            value={caption}
            rows={6}
            maxLength={3000}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full resize-y rounded-row border border-ink-line bg-panel px-3.5 py-3 text-[15px] leading-normal text-on-panel"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!posted && (
          <Button size="sm" variant="mint" icon={<Sparkles size={15} aria-hidden="true" />} onClick={write} disabled={busy !== null}>
            {busy === "write" ? "Writing…" : caption ? "Write a new caption" : "Write caption"}
          </Button>
        )}
        <Button size="sm" variant="ghost-dark" weight="medium" icon={copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} onClick={copy} disabled={!post.hook && !caption}>
          {copied ? "Copied" : "Copy"}
        </Button>
        {captionChanged && (
          <Button size="sm" variant="ghost-dark" weight="medium" onClick={saveCaption} disabled={busy !== null}>
            {busy === "save" ? "Saving…" : "Save caption"}
          </Button>
        )}
        {posted ? (
          <>
            <Chip tone="mint" className="inline-flex items-center gap-1">
              <Check size={14} strokeWidth={2.6} aria-hidden="true" />
              Posted{post.postedAt ? ` ${dayLabel(post.postedAt.slice(0, 10))}` : ""}
            </Chip>
            <Button size="sm" variant="ghost-dark" weight="medium" icon={<Undo2 size={15} aria-hidden="true" />} onClick={() => setStatus(caption ? "drafted" : "idea")} disabled={busy !== null}>
              Undo
            </Button>
          </>
        ) : (
          <Button size="sm" variant="light" icon={<Send size={15} aria-hidden="true" />} onClick={() => setStatus("posted")} disabled={busy !== null}>
            Mark as posted
          </Button>
        )}
      </div>

      {!posted &&
        (moving ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-day`} className="text-sm text-on-dark">
              New day
            </label>
            <input id={`${id}-day`} type="date" defaultValue={post.day} className={`${inputClass} w-auto`} onChange={(e) => e.target.value && move(e.target.value)} />
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={() => setMoving(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => setMoving(true)} className="min-h-11 self-start text-sm font-medium text-on-dark underline hover:text-on-panel">
            Move to another day
          </button>
        ))}

      {message && (
        <p className="m-0 text-sm" role="alert">
          {message}
        </p>
      )}
    </article>
  );
}
