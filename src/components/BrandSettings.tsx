"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";
import { BRAND_SWATCHES, brandColors, contrast, isHex, textOn } from "@/lib/brand";
import { useLoadedData } from "@/lib/data";
import { saveBrandColors } from "@/lib/store";

/** Settings: the two brand colors used on post templates (Content page). */
export function BrandSettings() {
  const { business } = useLoadedData();
  const start = brandColors(business);
  const [primary, setPrimary] = useState(start.primary);
  const [accent, setAccent] = useState(start.accent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const changed = primary !== start.primary || accent !== start.accent;
  const name = business.businessName || business.ownerName;

  async function save() {
    if (!isHex(primary) || !isHex(accent)) return;
    setSaving(true);
    await saveBrandColors(primary, accent);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card title="Your brand">
      <p className="mt-1.5 mb-4 text-[15px] leading-normal text-muted">
        Two colors for the post images on the Content page. Pick a ready-made pair or choose your own.
      </p>
      <div className="flex flex-wrap items-start gap-6">
        <div
          className="flex size-28 shrink-0 flex-col justify-end rounded-[18px] p-3"
          style={{ background: primary, color: textOn(primary) }}
          role="img"
          aria-label="How your colors look together"
        >
          <span className="mb-1.5 h-1.5 w-8 rounded-full" style={{ background: accent }} />
          <span className="text-sm leading-tight font-semibold">{name}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-4">
            {[
              { id: "brand-primary", label: "Main color", value: primary, set: setPrimary },
              { id: "brand-accent", label: "Accent color", value: accent, set: setAccent },
            ].map((c) => (
              <div key={c.id} className="flex items-center gap-2.5">
                <input
                  id={c.id}
                  type="color"
                  value={c.value}
                  onChange={(e) => c.set(e.target.value.toUpperCase())}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-line-strong bg-card p-1"
                />
                <label htmlFor={c.id} className="text-[15px] font-medium">
                  {c.label}
                </label>
              </div>
            ))}
          </div>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Ready-made color pairs">
            {BRAND_SWATCHES.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  onClick={() => {
                    setPrimary(s.primary);
                    setAccent(s.accent);
                  }}
                  aria-pressed={primary === s.primary && accent === s.accent}
                  aria-label={s.name}
                  title={s.name}
                  className="flex min-h-11 items-center gap-1 rounded-full border border-line-strong bg-card px-2.5 aria-pressed:border-ink"
                >
                  <span className="size-5 rounded-full" style={{ background: s.primary }} aria-hidden="true" />
                  <span className="size-5 rounded-full" style={{ background: s.accent }} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {contrast(primary, accent) < 1.5 && (
            <p className="m-0 text-sm text-muted">These two colors are very close. Pick a lighter or darker accent so it stands out.</p>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={!changed || saving}>
              {saving ? "Saving…" : "Save colors"}
            </Button>
            {saved && (
              <span className="text-sm text-muted" role="status">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
