"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";
import { Field, inputClass, MoneyInput } from "./Field";
import { QuickIncome, type PaidFrom } from "./money/QuickIncome";
import { familyOf } from "@/lib/business-kinds";
import { activeItems, validAmount } from "@/lib/catalog";
import { useAppData } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { knownClientNames, matchClientName } from "@/lib/money";
import { addTransaction, type Transaction } from "@/lib/store";

export type MoneyKind = Transaction["kind"];

/**
 * Pop-up to log money coming in or going out. Money in starts from the catalog (QuickIncome:
 * a tap or two); "Type it in instead" (and money out) use the typed form.
 */
export function AddMoneyDialog({
  kind,
  incomeCategory,
  paid,
  onClose,
}: {
  /** null = closed */
  kind: MoneyKind | null;
  /** What a paid visit is called for this business, like "Session" */
  incomeCategory: string;
  /** "Got paid" on a calendar appointment */
  paid?: PaidFrom;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const data = useAppData();
  const [typed, setTyped] = useState(false);
  const hasCatalog = activeItems(data?.catalog ?? []).length > 0;
  const close = () => {
    setTyped(false);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (kind && !dialog.open) dialog.showModal();
    if (!kind && dialog.open) dialog.close();
  }, [kind]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="add-money-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-card border border-line bg-card p-0 text-ink backdrop:bg-black/50"
    >
      {kind === "income" && !typed && (hasCatalog || paid) ? (
        <QuickIncome key={paid?.eventId ?? "in"} paid={paid} onTypeInstead={() => setTyped(true)} onClose={close} />
      ) : (
        kind && <MoneyForm key={kind} kind={kind} incomeCategory={incomeCategory} paid={kind === "income" ? paid : undefined} onClose={close} />
      )}
    </dialog>
  );
}

function MoneyForm({ kind: startKind, incomeCategory, paid, onClose }: { kind: MoneyKind; incomeCategory: string; paid?: PaidFrom; onClose: () => void }) {
  const [kind, setKind] = useState<MoneyKind>(startKind);
  const [amount, setAmount] = useState(paid?.price ?? 0);
  const [label, setLabel] = useState(paid?.title ?? "");
  const [date, setDate] = useState(paid?.eventDate ?? todayISO());
  const [client, setClient] = useState(paid?.clientName ?? "");
  const data = useAppData();
  const family = familyOf(data?.business?.type);
  const knownClients = knownClientNames(data?.transactions ?? [], data?.events ?? []);
  const categories =
    kind === "income"
      ? [incomeCategory, "Gift card", "Tip", "Other"]
      : ["Supplies", "Rent", "Ads", "Insurance", "Apps", "Other"];
  const [category, setCategory] = useState(categories[0]);
  const [saving, setSaving] = useState(false);
  const canSave = amount > 0 && validAmount(amount) && label.trim().length > 0 && date.length === 10;

  const switchKind = (next: MoneyKind) => {
    setKind(next);
    setCategory(next === "income" ? incomeCategory : "Supplies");
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const clientName = kind === "income" && client.trim() ? matchClientName(client, knownClients).slice(0, 80) : undefined;
    await addTransaction({
      kind,
      amount,
      label: label.trim(),
      category,
      date,
      ...(clientName ? { clientName } : {}),
      ...(paid && kind === "income" ? { eventId: paid.eventId, eventDate: paid.eventDate } : {}),
    });
    onClose();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="add-money-title" className="m-0 text-[22px] font-semibold">
          {kind === "income" ? "Add money in" : "Add money out"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div role="radiogroup" aria-label="Money in or out" className="grid grid-cols-2 gap-1 rounded-xl bg-line-soft p-1">
        {(["income", "expense"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => switchKind(k)}
            className={`min-h-11 rounded-lg text-[15px] ${kind === k ? "bg-card font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {k === "income" ? "Money in" : "Money out"}
          </button>
        ))}
      </div>

      <Field label="How much?">
        {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} size="lg" />}
      </Field>

      <Field label={kind === "income" ? "What was it for?" : "What did you buy?"}>
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={kind === "income" ? `Like “${family.words.itemExample}”` : "Like “Supplies”"}
          />
        )}
      </Field>

      {kind === "income" && family.tracksCustomers && (
        <Field label="Who was it? (optional)" help="Helps Second notice when a regular hasn't been back in a while.">
          {(id) => (
            <>
              <input
                id={id}
                className={inputClass}
                value={client}
                maxLength={80}
                autoComplete="off"
                list={knownClients.length ? `${id}-clients` : undefined}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Like “Sarah K.”"
              />
              {knownClients.length > 0 && (
                <datalist id={`${id}-clients`}>
                  {knownClients.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              )}
            </>
          )}
        </Field>
      )}

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[15px] font-medium">Kind</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-11 rounded-full px-4 text-[15px] ${
                category === c ? "bg-sky text-on-sky" : "border border-line-strong bg-card text-ink hover:border-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="When?">
        {(id) => (
          <input
            id={id}
            type="date"
            max={todayISO()}
            className={inputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-wrap justify-end gap-3 border-t border-line-soft pt-5">
        <Button variant="ghost" weight="medium" onClick={onClose}>
          Cancel
        </Button>
        <button
          type="submit"
          disabled={!canSave || saving}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-sky px-6 text-[15px] font-semibold text-on-sky hover:bg-sky-ink disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {!canSave && (
        <p className="-mt-2 mb-0 text-right text-sm text-muted" aria-live="polite">
          Add an amount and what it was for to save.
        </p>
      )}
    </form>
  );
}
