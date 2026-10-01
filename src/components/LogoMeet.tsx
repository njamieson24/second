// The logo, animated: the owner's circle and their Second's ring slide in from
// either side and link up, then a soft halo pulses out.

const confettiDots = [
  { dx: "-78px", dy: "-46px", size: 10, color: "bg-mint", delay: 700 },
  { dx: "82px", dy: "-40px", size: 12, color: "bg-sky-light", delay: 760 },
  { dx: "-96px", dy: "18px", size: 8, color: "bg-sun", delay: 820 },
  { dx: "100px", dy: "26px", size: 9, color: "bg-mint", delay: 740 },
  { dx: "-40px", dy: "-70px", size: 7, color: "bg-sky", delay: 880 },
  { dx: "46px", dy: "-72px", size: 8, color: "bg-sun", delay: 800 },
  { dx: "-60px", dy: "56px", size: 9, color: "bg-sky-light", delay: 900 },
  { dx: "64px", dy: "58px", size: 7, color: "bg-mint", delay: 860 },
];

const gapStroke = { card: "stroke-card", paper: "stroke-paper", panel: "stroke-panel" };

export function LogoMeet({
  width = 132,
  confetti = false,
  surface = "card",
}: {
  width?: number;
  confetti?: boolean;
  /** The background it sits on, so the gap in the ring matches */
  surface?: keyof typeof gapStroke;
}) {
  return (
    <div className="relative flex items-center justify-center" style={{ width, height: (width * 56) / 88 }} aria-hidden="true">
      {confetti &&
        confettiDots.map((d, i) => (
          <span
            key={i}
            className={`absolute rounded-full ${d.color} animate-confetti motion-reduce:hidden`}
            style={
              {
                width: d.size,
                height: d.size,
                "--dx": d.dx,
                "--dy": d.dy,
                animationDelay: `${d.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      <svg width={width} height={(width * 56) / 88} viewBox="0 0 88 56" className="overflow-visible">
        {/* Halo where they meet */}
        <circle
          cx="44"
          cy="28"
          r="30"
          fill="none"
          strokeWidth="2"
          className="origin-center stroke-mint animate-halo [transform-box:fill-box] motion-reduce:hidden"
        />
        <g className="animate-logo-owner motion-reduce:animate-none">
          <circle cx="28" cy="28" r="24" className="fill-sky" />
        </g>
        <g className="animate-logo-second motion-reduce:animate-none">
          {/* Drawn twice: a thick card-colored stroke makes the gap where the ring crosses the circle */}
          <circle cx="60" cy="28" r="21" fill="none" strokeWidth="12" className={gapStroke[surface]} />
          <circle cx="60" cy="28" r="21" fill="none" strokeWidth="6" className="stroke-mint" />
        </g>
      </svg>
    </div>
  );
}
