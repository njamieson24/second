import { Camera } from "lucide-react";
import { Button } from "@/components/Button";
import { Card, ListRow } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TipCard } from "@/components/TipCard";
import { comingUp, contentPosts } from "@/lib/mock-data";

const photoTones = {
  sky: { box: "bg-sky-tint text-sky-ink", icon: "", chip: "sky" },
  mint: { box: "bg-mint-tint text-mint-deep", icon: "", chip: "mint" },
  dark: { box: "bg-panel text-on-panel", icon: "text-panel-accent", chip: "neutral" },
} as const;

export default function ContentPage() {
  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Content"
        subtitle="This week's Instagram posts, written for you"
        actions={<Button>Connect Instagram</Button>}
      />

      <div className="grid grid-cols-1 gap-5 desk:grid-cols-3">
        {contentPosts.map((post) => {
          const t = photoTones[post.tone];
          return (
            <article key={post.day} className="flex flex-col overflow-hidden rounded-card border border-line bg-card">
              <div
                className={`flex h-[260px] flex-col items-center justify-center gap-2 p-5 text-center ${t.box}`}
              >
                <Camera size={32} strokeWidth={1.8} aria-hidden="true" className={t.icon} />
                <span className="text-[15px] font-medium">{post.idea}</span>
              </div>
              <div className="flex grow flex-col gap-3 px-5 py-[18px]">
                <h2 className="m-0">
                  <Chip tone={t.chip}>
                    {post.day}
                  </Chip>
                </h2>
                <p className="m-0 grow text-[15px] leading-normal">{post.caption}</p>
                <div className="flex gap-2">
                  <Button variant="dark" size="sm">
                    Copy caption
                  </Button>
                  <Button variant="soft" size="sm" weight="normal" pad="tight">
                    Edit
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Card padding="lg">
          <h2 className="m-0 mb-2 text-[17px] font-semibold">Coming up</h2>
          {comingUp.map((item, i) => (
            <ListRow key={item.label} last={i === comingUp.length - 1}>
              <span>{item.label}</span>
              <span className="whitespace-nowrap text-muted">{item.date}</span>
            </ListRow>
          ))}
        </Card>

        <TipCard title="Want different posts?" className="flex flex-col gap-2.5">
          <p className="m-0 text-[15px] leading-normal text-mint-heading">
            Tell Second what you want more of, like &quot;more tips&quot; or &quot;more behind the scenes,&quot; and
            it will rewrite the week.
          </p>
          <div>
            <Button href="/chat" variant="green" pad="tight">
              Ask Second
            </Button>
          </div>
        </TipCard>
      </div>
    </PageBody>
  );
}
