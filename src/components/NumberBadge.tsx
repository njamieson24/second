const tones = {
  "sky-light": "bg-sky-light text-sky-deep",
  mint: "bg-mint text-mint-ink",
  "sky-tint": "bg-sky-tint text-sky-ink",
};

export function NumberBadge({ n, tone = "sky-light" }: { n: number; tone?: keyof typeof tones }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full font-semibold ${tones[tone]}`}
      aria-hidden="true"
    >
      {n}
    </span>
  );
}
