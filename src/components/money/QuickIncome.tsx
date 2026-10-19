"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Minus, Plus, Repeat2, X } from "lucide-react";
import { Button } from "@/components/Button";
import { inputClass, MoneyInput } from "@/components/Field";
import { capital, familyOf } from "@/lib/business-kinds";
import { activeItems, activeVariants, entryName, entryTotal, validAmount, variantName, CATALOG_LIMITS, type CatalogItem, type CatalogVariant } from "@/lib/catalog";
import { useLoadedData } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { formatMoney, knownClientNames, matchClientName } from "@/lib/money";
import { addTransaction, type Transaction } from "@/lib/store";

/** "Got paid" from a calendar appointment: what we already know about it. */
export type PaidFrom = { eventId: string; eventDate: string; title: string; clientName?: string; price?: number };

type Pick = { item: CatalogItem; variant: CatalogVariant };

const tile =
  "flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-row border border-line-strong bg-card px-4 py-3 text-left text-ink transition-colors hover:border-ink focus-visible:border-sky";

/**
 * Money in, from the catalog: tap what it was, tap the option, the price fills in. Big targets,
 * so it works one-handed between appointments. The amount stays editable; tip, discount and
 * how many are optional. The total is price x how many - discount + tip (the database does the
 * same sum and wins).
 */
export function QuickIncome({ paid, onTypeInstead, onClose }: { paid?: PaidFrom; onTypeInstead: () => void; onClose: () => void }) {
  const { business, catalog, transactions, events } = useLoadedData();
  const family = familyOf(business.type);
  const w = family.words;
  const items = activeItems(catalog);
  const count = items.length;

  // Started from an appointment: guess the service from its title (the owner can change it).
  const guessed = useMemo<Pick | null>(() => {
    if (!paid) return null;
    const title = paid.title.toLowerCase();
    const item = [...items].sort((a, b) => b.name.length - a.name.length).find((i) => title.includes(i.name.toLowerCase()));
    const vs = item ? activeVariants(item) : [];
    return item && vs.length === 1 ? { item, variant: vs[0] } : null;
  }, [paid, items]);

  const [picked, setPicked] = useState<Pick | null>(guessed);
  const [choosingVariantOf, setChoosingVariantOf] = useState<CatalogItem | null>(null);
  const [unitPrice, setUnitPrice] = useState(guessed ? (paid?.price ?? guessed.variant.price) : 0);
  const [quantity, setQuantity] = useState(1);
  const [tip, setTip] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [extras, setExtras] = useState(false);
  const [client, setClient] = useState(paid?.clientName ?? "");
  const [date, setDate] = useState(paid?.eventDate ?? todayISO());
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const choose = (p: Pick, price?: number, qty = 1) => {
    setPicked(p);
    setChoosingVariantOf(null);
    setUnitPrice(price ?? paid?.price ?? p.variant.price);
    setQuantity(qty);
  };
  const tapItem = (item: CatalogItem) => {
    const vs = activeVariants(item);
    if (vs.length === 1) choose({ item, variant: vs[0] });
    else setChoosingVariantOf(item);
  };

  // Repeat last, and the most-used items (last 90 days) first.
  const incomeFromCatalog = transactions.filter((t) => t.kind === "income" && t.itemId && t.variantId);
  const findPick = (t: Transaction): Pick | null => {
    const item = items.find((i) => i.id === t.itemId);
    const variant = item && activeVariants(item).find((v) => v.id === t.variantId);
    return item && variant ? { item, variant } : null;
  };
  const last = [...incomeFromCatalog].reverse().map((t) => ({ t, p: findPick(t) })).find((x) => x.p);
  const since = addDays(todayISO(), -90);
  const usage = new Map<string, { p: Pick; n: number }>();
  for (const t of incomeFromCatalog) {
    if (t.date < since) continue;
    const p = findPick(t);
    if (!p) continue;
    const key = p.variant.id;
    usage.set(key, { p, n: (usage.get(key)?.n ?? 0) + 1 });
  }
  const mostUsed = [...usage.values()].sort((a, b) => b.n - a.n).slice(0, 4).map((x) => x.p);

  const total = entryTotal({ unitPrice, quantity, discount, tip });
  const recentClients = knownClientNames(transactions, events).slice(0, 4);
  const today = todayISO();
  const yesterday = addDays(today, -1);
  const alreadyLogged = paid ? transactions.some((t) => t.eventId === paid.eventId && (t.eventDate ?? t.date) === paid.eventDate) : false;

  async function save() {
    if (!picked) return;
    setProblem(null);
    if (!validAmount(unitPrice) || !validAmount(tip) || !validAmount(discount)) return setProblem("Amounts go up to $100,000.");
    if (total <= 0) return setProblem("The total has to be more than $0.");
    if (total > CATALOG_LIMITS.maxEntry) return setProblem("One entry can be up to $100,000.");
    if (date > today) return setProblem("That date hasn't happened yet.");
    if (alreadyLogged) return setProblem("This appointment is already logged.");
    setSaving(true);
    const clientName = family.tracksCustomers && client.trim() ? matchClientName(client, knownClientNames(transactions, events)).slice(0, 80) : undefined;
    await addTransaction({
      kind: "income",
      amount: total,
      label: entryName(picked.item, picked.variant, activeVariants(picked.item).length),
      category: capital(w.visit),
      date,
      itemId: picked.item.id,
      variantId: picked.variant.id,
      quantity,
      unitPrice,
      ...(discount ? { discount } : {}),
      ...(tip ? { tip } : {}),
      ...(clientName ? { clientName } : {}),
      ...(paid ? { eventId: paid.eventId, eventDate: paid.eventDate } : {}),
    });
    onClose();
  }

  const header = (title: string, back?: () => void) => (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <button type="button" onClick={back} aria-label="Back" className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink">
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        )}
        <h2 id="add-money-title" className="m-0 text-[22px] leading-tight font-semibold break-words">
          {title}
        </h2>
      </div>
      <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink">
        <X size={20} aria-hidden="true" />
      </button>
    </div>
  );

  const priceRange = (item: CatalogItem) => {
    const ps = activeVariants(item).map((v) => v.price);
    const lo = Math.min(...ps);
    const hi = Math.max(...ps);
    return lo === hi ? formatMoney(lo) : `${formatMoney(lo)} to ${formatMoney(hi)}`;
  };

  // ---------- 2. Which option (30/60/90 min, small/large) ----------
  if (choosingVariantOf) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header(choosingVariantOf.name, () => setChoosingVariantOf(null))}
        <p className="m-0 text-[15px] text-muted">Which {w.variantNoun}?</p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {activeVariants(choosingVariantOf).map((v) => (
            <button key={v.id} type="button" className={tile} onClick={() => choose({ item: choosingVariantOf, variant: v })}>
              <span className="text-[17px] font-semibold">{variantName(v) || choosingVariantOf.name}</span>
              <span className="text-[15px] text-muted">{formatMoney(v.price)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- 3. Check it and save ----------
  if (picked) {
    const name = entryName(picked.item, picked.variant, activeVariants(picked.item).length);
    return (
      <form
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {header(name, paid && guessed && picked === guessed ? undefined : () => setPicked(null))}
        {paid && <p className="m-0 -mt-2 text-sm text-muted">From your calendar: {paid.title}</p>}

        <label className="flex flex-col gap-1.5 text-[15px] font-medium">
          Price
          <MoneyInput value={unitPrice} onChange={setUnitPrice} size="lg" label="Price" />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-medium" id="qty-label">
            How many
          </span>
          <div className="flex items-center gap-1 rounded-full border border-line-strong bg-card p-1" role="group" aria-labelledby="qty-label">
            <button type="button" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex size-12 items-center justify-center rounded-full hover:bg-line-soft disabled:opacity-40">
              <Minus size={20} aria-hidden="true" />
            </button>
            <span className="min-w-10 text-center text-[19px] font-semibold tabular-nums" aria-live="polite">
              {quantity}
            </span>
            <button type="button" aria-label="One more" disabled={quantity >= CATALOG_LIMITS.maxQuantity} onClick={() => setQuantity((q) => Math.min(CATALOG_LIMITS.maxQuantity, q + 1))} className="flex size-12 items-center justify-center rounded-full hover:bg-line-soft disabled:opacity-40">
              <Plus size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {extras ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Tip
              <MoneyInput value={tip} onChange={setTip} label="Tip" />
            </label>
            <label className="flex flex-col gap-1.5 text-[15px] font-medium">
              Discount
              <MoneyInput value={discount} onChange={setDiscount} label="Discount" />
            </label>
          </div>
        ) : (
          <button type="button" onClick={() => setExtras(true)} className="min-h-11 self-start text-[15px] font-medium text-sky-ink underline">
            Add a tip or discount
          </button>
        )}

        {family.tracksCustomers && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="quick-client" className="text-[15px] font-medium">
              Who was it? (optional)
            </label>
            <input id="quick-client" className={inputClass} value={client} maxLength={80} autoComplete="off" onChange={(e) => setClient(e.target.value)} placeholder={`Their name, like "Sarah K."`} />
            {recentClients.length > 0 && !client && (
              <div className="flex flex-wrap gap-2" aria-label={`Recent ${w.customers}`}>
                {recentClients.map((n) => (
                  <button key={n} type="button" onClick={() => setClient(n)} className="min-h-11 rounded-full border border-line-strong bg-card px-4 text-[15px] hover:border-ink">
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[15px] font-medium">When?</legend>
          <div className="flex flex-wrap items-center gap-2">
            {[
              [today, "Today"],
              [yesterday, "Yesterday"],
            ].map(([d, label]) => (
              <button
                key={d}
                type="button"
                aria-pressed={date === d}
                onClick={() => setDate(d)}
                className={`min-h-11 rounded-full px-4 text-[15px] ${date === d ? "bg-sky text-on-sky" : "border border-line-strong bg-card text-ink hover:border-ink"}`}
              >
                {label}
              </button>
            ))}
            <input type="date" max={today} aria-label="Pick a day" className={`${inputClass} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </fieldset>

        {problem && (
          <p role="alert" className="m-0 text-[15px] text-ink">
            {problem}
          </p>
        )}
        {alreadyLogged && <p className="m-0 text-[15px] text-ink">This appointment is already logged.</p>}

        <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
          <div className="flex items-baseline justify-between text-[15px]">
            <span className="text-muted">Total{tip ? `, with ${formatMoney(tip)} tip` : ""}</span>
            <span className="text-[28px] font-semibold tabular-nums">{formatMoney(total)}</span>
          </div>
          <button
            type="submit"
            disabled={saving || total <= 0 || alreadyLogged}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-sky px-6 text-[17px] font-semibold text-on-sky hover:bg-sky-ink disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
          >
            {saving ? "Saving…" : `Save ${formatMoney(total)}`}
          </button>
        </div>
      </form>
    );
  }

  // ---------- 1. What was it? ----------
  return (
    <div className="flex flex-col gap-4 p-6">
      {header(paid ? `Got paid: ${paid.title}` : "Add money in")}
      {paid && <p className="m-0 -mt-2 text-[15px] text-muted">Which {w.item} was it?</p>}

      {!paid && last?.p && (
        <button type="button" className={`${tile} border-sky bg-sky-tint`} onClick={() => choose(last.p!, last.t.unitPrice, last.t.quantity ?? 1)}>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-sky-ink">
            <Repeat2 size={15} aria-hidden="true" /> Repeat last
          </span>
          <span className="text-[17px] font-semibold">{entryName(last.p.item, last.p.variant, activeVariants(last.p.item).length)}</span>
          <span className="text-[15px] text-muted">{formatMoney(last.t.unitPrice ?? last.p.variant.price)}{(last.t.quantity ?? 1) > 1 ? ` × ${last.t.quantity}` : ""}</span>
        </button>
      )}

      {!paid && mostUsed.length > 1 && (
        <section aria-labelledby="most-used" className="flex flex-col gap-2">
          <h3 id="most-used" className="m-0 text-[15px] font-semibold text-muted">
            You log these most
          </h3>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {mostUsed.map((p) => (
              <button key={p.variant.id} type="button" className={tile} onClick={() => choose(p)}>
                <span className="text-[17px] font-semibold">{entryName(p.item, p.variant, activeVariants(p.item).length)}</span>
                <span className="text-[15px] text-muted">{formatMoney(p.variant.price)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-items" className="flex flex-col gap-2">
        <h3 id="all-items" className="m-0 text-[15px] font-semibold text-muted">
          {count ? `All your ${w.items}` : `No ${w.items} yet`}
        </h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {items.map((item) => (
            <button key={item.id} type="button" className={tile} onClick={() => tapItem(item)}>
              <span className="text-[17px] font-semibold">{item.name}</span>
              <span className="text-[15px] text-muted">{priceRange(item)}</span>
            </button>
          ))}
        </div>
        {!count && (
          <p className="m-0 text-[15px] text-muted">
            Add what you sell in Settings, and logging money is a tap or two.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        <Button variant="soft" weight="medium" size="sm" onClick={onTypeInstead}>
          Type it in instead
        </Button>
        {paid?.price ? <span className="text-sm text-muted">Calendar price: {formatMoney(paid.price)}</span> : null}
      </div>
    </div>
  );
}
