/* eslint-disable @next/next/no-img-element -- map tiles are plain images from OpenStreetMap */

// A small, still map: OpenStreetMap tiles, the owner's pin and numbered pins for the matches.
// No map library. Positions are worked out on a 600 x 300 canvas and placed in percentages,
// so it scales to any width.

type Point = { lat: number; lon: number };

const W = 600;
const H = 300;
const TILE = 256;

const project = (p: Point, z: number) => {
  const scale = TILE * 2 ** z;
  const s = Math.sin((p.lat * Math.PI) / 180);
  return { x: ((p.lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
};

export function MatchMap({ center, pins }: { center: Point; pins: Point[] }) {
  const all = [center, ...pins];
  // The closest zoom where every pin fits with a margin.
  let z = 15;
  for (; z > 8; z--) {
    const ps = all.map((p) => project(p, z));
    const w = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const h = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    if (w <= W - 80 && h <= H - 80) break;
  }
  const ps = all.map((p) => project(p, z));
  const mid = {
    x: (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2,
    y: (Math.max(...ps.map((p) => p.y)) + Math.min(...ps.map((p) => p.y))) / 2,
  };
  const left = mid.x - W / 2;
  const top = mid.y - H / 2;
  const tiles: { x: number; y: number }[] = [];
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + W) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + H) / TILE); ty++) tiles.push({ x: tx, y: ty });
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const n = 2 ** z;

  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-card border border-line bg-line-soft" role="img" aria-label={`Map: you and ${pins.length} businesses near you`}>
      {tiles.map((t) => (
        <img
          key={`${t.x}-${t.y}`}
          src={`https://tile.openstreetmap.org/${z}/${((t.x % n) + n) % n}/${t.y}.png`}
          alt=""
          draggable={false}
          className="absolute max-w-none select-none dark:brightness-[0.8] dark:contrast-[1.1]"
          style={{ left: pct(t.x * TILE - left, W), top: pct(t.y * TILE - top, H), width: pct(TILE, W), height: pct(TILE, H) }}
        />
      ))}
      {ps.map((p, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-semibold shadow-md ring-2 ring-card ${
            i === 0 ? "size-6 bg-sky" : "size-8 bg-mint text-[15px] text-on-green"
          }`}
          style={{ left: pct(p.x - left, W), top: pct(p.y - top, H) }}
        >
          {i === 0 ? <span className="size-2.5 rounded-full bg-card" /> : i}
        </span>
      ))}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute right-0 bottom-0 rounded-tl-md bg-card/90 px-1.5 py-0.5 text-[11px] text-ink no-underline"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
