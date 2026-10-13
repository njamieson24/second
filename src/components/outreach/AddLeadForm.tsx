"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { Field, inputClass } from "@/components/Field";
import { CATEGORIES, type CategoryId, type Lead } from "@/lib/outreach";
import { addManualLead } from "@/lib/store";

/** "Add a business yourself": for places the map doesn't have. */
export function AddLeadForm({ town, onAdded }: { town: string; onAdded: (lead: Lead) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<CategoryId>("retail");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="soft" size="sm" weight="medium" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>
        Add a business yourself
      </Button>
    );
  }

  async function add() {
    if (!name.trim()) return setProblem("Please type the business name.");
    setBusy(true);
    setProblem(null);
    const r = await addManualLead({ name, website, email, category, town });
    setBusy(false);
    if (!r.ok) return setProblem(r.message);
    onAdded(r.lead);
    setName("");
    setWebsite("");
    setEmail("");
    setOpen(false);
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-line bg-card p-[22px]"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <h2 className="m-0 text-[17px] font-semibold">Add a business yourself</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Business name">{(id) => <input id={id} className={inputClass} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} required />}</Field>
        <Field label="Kind of business">
          {(id) => (
            <select id={id} className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Website (optional)">{(id) => <input id={id} className={inputClass} value={website} maxLength={500} placeholder="example.com" onChange={(e) => setWebsite(e.target.value)} />}</Field>
        <Field label="Email (optional)">{(id) => <input id={id} type="email" className={inputClass} value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} />}</Field>
      </div>
      {problem && (
        <p role="alert" className="m-0 text-[15px] text-ink">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-full bg-sky px-5 text-[15px] font-semibold text-on-sky hover:bg-sky-ink disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add it"}
        </button>
        <Button size="sm" variant="soft" weight="medium" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
