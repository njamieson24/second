"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Send, Sparkles } from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { inputClass } from "../Field";
import { TemplatePreview } from "./TemplatePreview";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, TEMPLATE_SIZES, type ContentPost, type TemplateSize, type TemplateText } from "@/lib/content";
import { dayLabel } from "@/lib/dates";
import { FIELD_LABELS, TEMPLATES, type Brand, type DrawResult, type TemplateField } from "@/lib/templates";
import { updateContentPost, writeContentCaption, type ContentPostChanges } from "@/lib/store";

/** A good starting layout for each kind of post. */
const START_TEMPLATE: Record<ContentPost["type"], string> = {
  promo: "price",
  tip: "tip",
  behind_the_scenes: "behind",
  client_love: "thanks",
  slow_day: "open_week",
  launch_countdown: "countdown",
  other: "headline",
};

/** Caption on one side, the branded template on the other (stacked on phones). */
export function PostEditor({ post, brand, onChange }: { post: ContentPost; brand: Brand; onChange: (changes: Partial<ContentPost>) => void }) {
  const [caption, setCaption] = useState(post.caption ?? "");
  const [template, setTemplate] = useState(post.template ?? START_TEMPLATE[post.type]);
  const [size, setSize] = useState<TemplateSize>(post.templateSize ?? "square");
  const [text, setText] = useState<TemplateText>(post.templateText ?? { headline: post.title });
  const [busy, setBusy] = useState<"write" | "save" | "status" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(false);
  const [drawn, setDrawn] = useState<DrawResult>({ tooLong: [], missing: [] });
  const info = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];
  const textKey = JSON.stringify(text);
  const stableText = useMemo(() => JSON.parse(textKey) as TemplateText, [textKey]);

  async function save(changes: ContentPostChanges, local: Partial<ContentPost>, kind: "save" | "status" = "save") {
    setBusy(kind);
    setMessage(null);
    const ok = await updateContentPost(post.id, changes);
    setBusy(null);
    if (ok) onChange(local);
    else setMessage("We couldn't save that. Please try again.");
    return ok;
  }

  async function write() {
    setBusy("write");
    setMessage(null);
    const r = await writeContentCaption(post.id, [text.quote, text.offer].filter(Boolean).join(" "));
    setBusy(null);
    if (!r.ok) return setMessage(r.message);
    setCaption(r.caption);
    const merged = { ...text, ...r.templateText };
    setText(merged);
    onChange({ caption: r.caption, templateText: merged, status: post.status === "idea" ? "drafted" : post.status });
  }

  async function saveAll() {
    await save(
      { caption: caption || null, template, templateSize: size, templateText: text, ...(post.status === "idea" && caption.trim() ? { status: "drafted" } : {}) },
      { caption: caption || null, template, templateSize: size, templateText: text, ...(post.status === "idea" && caption.trim() ? { status: "drafted" as const } : {}) },
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Your browser blocked copying. Select the text and copy it yourself.");
    }
  }

  const setField = (f: TemplateField, v: string) => setText((t) => ({ ...t, [f]: v }));

  return (
    <Card
      title="Write and design"
      aside={
        <span className="flex flex-wrap items-center gap-2">
          <Chip tone="neutral">{POST_TYPE_LABELS[post.type]}</Chip>
          <Chip tone={post.status === "posted" || post.status === "ready" ? "mint" : "sky"}>{POST_STATUS_LABELS[post.status]}</Chip>
        </span>
      }
      padding="lg"
    >
      <div className="mt-1 mb-4">
        <h3 className="m-0 text-lg font-semibold">{post.title}</h3>
        <p className="mt-0.5 mb-0 text-[15px] text-muted">
          {post.why} · Planned for {dayLabel(post.day, true)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-2">
        {/* Caption + template text */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`caption-${post.id}`} className="text-[15px] font-medium">
              Caption
            </label>
            <textarea
              id={`caption-${post.id}`}
              value={caption}
              rows={8}
              maxLength={3000}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tap “Write it” and Second will draft a caption. You can change anything."
              className={`${inputClass} min-h-44 resize-y py-3 leading-normal`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={write} disabled={busy !== null}>
              {busy === "write" ? "Writing…" : caption ? "Write a new one" : "Write it"}
            </Button>
            <Button size="sm" variant="ghost" weight="medium" icon={copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} onClick={copy} disabled={!caption}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" weight="medium" onClick={saveAll} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save"}
            </Button>
          </div>
          <p className="m-0 text-[13px] text-muted">Second never posts anything. Copy the caption, save the image, and post it yourself.</p>

          <fieldset className="m-0 flex flex-col gap-3 rounded-row border border-line-soft p-4">
            <legend className="px-1 text-[15px] font-medium">Text on the image</legend>
            {info.fields.map((f) => {
              const id = `field-${post.id}-${f}`;
              const tooLong = drawn.tooLong.includes(f);
              const missing = drawn.missing.includes(f);
              return (
                <div key={f} className="flex flex-col gap-1">
                  <label htmlFor={id} className="text-sm font-medium">
                    {FIELD_LABELS[f]}
                  </label>
                  <input
                    id={id}
                    value={text[f] ?? ""}
                    maxLength={200}
                    onChange={(e) => setField(f, e.target.value)}
                    aria-invalid={tooLong || undefined}
                    aria-describedby={tooLong || missing ? `${id}-note` : undefined}
                    className={inputClass}
                  />
                  {tooLong && (
                    <p id={`${id}-note`} className="m-0 text-sm font-medium text-amber-ink">
                      Too long for this template
                    </p>
                  )}
                  {!tooLong && missing && (
                    <p id={`${id}-note`} className="m-0 text-sm text-muted">
                      Add this first
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        </div>

        {/* Template */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <label htmlFor={`template-${post.id}`} className="text-[15px] font-medium">
                Template
              </label>
              <select id={`template-${post.id}`} value={template} onChange={(e) => setTemplate(e.target.value)} className={inputClass}>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div role="radiogroup" aria-label="Image size" className="flex gap-1 rounded-xl bg-line-soft p-1">
              {(Object.keys(TEMPLATE_SIZES) as TemplateSize[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={size === s}
                  onClick={() => setSize(s)}
                  className={`min-h-11 rounded-lg px-3.5 text-[15px] ${size === s ? "bg-card font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {TEMPLATE_SIZES[s].label}
                </button>
              ))}
            </div>
          </div>
          <TemplatePreview
            template={template}
            size={size}
            text={stableText}
            brand={brand}
            onResult={setDrawn}
            onDownloaded={() => void updateContentPost(post.id, { template, templateSize: size, templateText: text })}
          />
        </div>
      </div>

      {/* Status and day */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        {post.status !== "posted" ? (
          <>
            {post.status !== "ready" && (
              <Button size="sm" variant="ghost" weight="medium" onClick={() => save({ status: "ready" }, { status: "ready" }, "status")} disabled={busy !== null || !caption.trim()}>
                Mark ready
              </Button>
            )}
            <Button
              size="sm"
              variant="green"
              icon={<Send size={15} aria-hidden="true" />}
              onClick={() => {
                const at = new Date().toISOString();
                void save({ status: "posted", postedAt: at, caption: caption || null }, { status: "posted", postedAt: at, caption: caption || null }, "status");
              }}
              disabled={busy !== null}
            >
              Mark as posted
            </Button>
          </>
        ) : (
          <>
            <Chip tone="mint">Posted{post.postedAt ? ` ${dayLabel(post.postedAt.slice(0, 10))}` : ""}</Chip>
            <Button size="sm" variant="ghost" weight="medium" onClick={() => save({ status: caption ? "ready" : "idea", postedAt: null }, { status: caption ? "ready" : "idea", postedAt: null }, "status")} disabled={busy !== null}>
              Undo
            </Button>
          </>
        )}
        {moving ? (
          <span className="flex flex-wrap items-center gap-2">
            <label htmlFor={`day-${post.id}`} className="sr-only">
              New day
            </label>
            <input
              id={`day-${post.id}`}
              type="date"
              defaultValue={post.day}
              className={`${inputClass} w-auto`}
              onChange={(e) => {
                if (e.target.value) void save({ day: e.target.value }, { day: e.target.value }).then(() => setMoving(false));
              }}
            />
            <Button size="sm" variant="ghost" weight="medium" onClick={() => setMoving(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button size="sm" variant="ghost" weight="medium" onClick={() => setMoving(true)}>
            Move to another day
          </Button>
        )}
      </div>
      {message && (
        <p className="mt-3 mb-0 text-[15px]" role="alert">
          {message}
        </p>
      )}
    </Card>
  );
}
