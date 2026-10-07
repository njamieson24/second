"use client";

import { ComingSoon, SampleTag } from "@/components/EmptyStates";
import { useLoadedData } from "@/lib/data";
import { Button } from "@/components/Button";
import { Card, ListRow } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TipCard } from "@/components/TipCard";
import { brandKit } from "@/lib/demo-content";

function SampleBrandKit() {
  return (
    <PageBody>
      <PageHeader
        size="lg"
        title="Brand kit"
        subtitle="Your name, logo, colors, and website. Second drafts them and you pick what you like."
        actions={<SampleTag />}
      />

      <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-3">
        <Card title="Name ideas">
          <div className="mt-1.5">
            {brandKit.nameIdeas.map((name, i) => (
              <ListRow key={name} last={i === brandKit.nameIdeas.length - 1}>
                <span className={i === 0 ? "font-medium" : ""}>{name}</span>
                {i === 0 && <Chip tone="mint">Favorite</Chip>}
              </ListRow>
            ))}
          </div>
        </Card>

        <Card title="Logo and colors">
          <div className="mt-3.5 flex items-center gap-3.5">
            <div
              className="flex size-16 items-center justify-center rounded-[18px] text-2xl font-semibold"
              style={{ background: brandKit.logoBackground, color: brandKit.logoText }}
              role="img"
              aria-label={`${brandKit.name} logo draft`}
            >
              {brandKit.initials}
            </div>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[15px]">
              {brandKit.colors.map((c) => (
                <li key={c.hex} className="flex items-center gap-2">
                  <span
                    className={`size-5 rounded-full ${c.light ? "border border-line" : ""}`}
                    style={{ background: c.hex }}
                    aria-hidden="true"
                  />
                  {c.name}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Getting found">
          <div className="mt-1.5">
            {brandKit.items.slice(1).map((item, i, all) => (
              <ListRow key={item.label} last={i === all.length - 1}>
                <span>{item.label}</span>
                <Chip tone={item.tone}>{item.status}</Chip>
              </ListRow>
            ))}
          </div>
        </Card>
      </div>

      <TipCard title="Want to see your website?">
        <p className="mt-1.5 mb-3 text-[15px] text-mint-heading">
          This page is still being built. For now, ask Second and it can walk you through your draft.
        </p>
        <Button href="/chat" variant="green">
          Ask Second
        </Button>
      </TipCard>
    </PageBody>
  );
}

export default function BrandKitPage() {
  const { showSamples } = useLoadedData();
  if (showSamples) return <SampleBrandKit />;
  return (
    <PageBody>
      <PageHeader size="lg" title="Brand kit" subtitle="Your name, logo, colors, and website." />
      <ComingSoon title="Second will help you look professional" text="Second will suggest names, draft a simple logo and colors, and build a one-page website with your prices and a booking button. You pick what you like." className="max-w-[720px]" />
    </PageBody>
  );
}
