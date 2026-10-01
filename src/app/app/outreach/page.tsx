import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { outreach } from "@/lib/mock-data";

export default function OutreachPage() {
  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Outreach"
        subtitle={outreach.subtitle}
        actions={
          <Button variant="ghost" weight="medium">
            Find new places
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 desk:grid-cols-4">
        {outreach.stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} valueGood={s.good} />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.1fr)]">
        <Column title="Waiting on reply" count={outreach.waiting.count} tone="neutral">
          {outreach.waiting.places.map((p) => (
            <PlaceCard key={p.name} name={p.name} detail={p.detail} />
          ))}
          <button type="button" className="min-h-11 self-start rounded-lg px-1 text-left text-sm font-medium text-sky-ink hover:underline">
            + {outreach.waiting.more} more
          </button>
        </Column>

        <Column title="Replied" count={outreach.replied.length} tone="sky">
          {outreach.replied.map((p) => (
            <PlaceCard key={p.name} name={p.name} detail={p.detail} chip={p.chip} chipTone={p.tone} />
          ))}
        </Column>

        <Column title="Booked" count={outreach.booked.length} tone="mint">
          {outreach.booked.map((p) => (
            <PlaceCard key={p.name} name={p.name} detail={p.detail} chip={p.chip} chipTone="mint" highlight />
          ))}
        </Column>

        <section className="on-dark flex flex-col gap-3 rounded-tile bg-panel p-[22px] ring-1 ring-ink-line text-on-panel">
          <span className="text-[13px] font-semibold text-panel-accent">Next batch ready</span>
          <h2 className="m-0 text-[21px] leading-tight font-semibold">{outreach.nextBatch.heading}</h2>
          <p className="m-0 text-[15px] leading-normal text-on-dark">{outreach.nextBatch.text}</p>
          <div>
            <Button href="/chat" variant="mint" pad="tight">
              Review drafts
            </Button>
          </div>
        </section>
      </div>
    </PageBody>
  );
}

const columnTones = {
  neutral: "bg-line-soft",
  sky: "bg-sky-tint text-sky-deep",
  mint: "bg-mint-tint text-mint-heading",
};

function Column({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: keyof typeof columnTones;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-2.5 rounded-tile p-4 ${columnTones[tone]}`}>
      <h2 className="m-0 flex justify-between px-1 text-[15px] font-semibold">
        <span>{title}</span>
        <span className={tone === "neutral" ? "text-muted" : ""}>
          {count}
          <span className="sr-only"> places</span>
        </span>
      </h2>
      {children}
    </section>
  );
}

function PlaceCard({
  name,
  detail,
  chip,
  chipTone = "sky",
  highlight,
}: {
  name: string;
  detail: string;
  chip?: string;
  chipTone?: "mint" | "sky" | "neutral";
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-[14px] bg-card px-3.5 py-3 text-ink ${highlight ? "border-[1.5px] border-mint" : ""}`}>
      <div className="text-[15px] font-medium">{name}</div>
      <div className="text-[13px] text-muted">{detail}</div>
      {chip && (
        <Chip tone={chipTone} size="sm" className="mt-2">
          {chip}
        </Chip>
      )}
    </div>
  );
}
