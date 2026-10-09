// Branded post templates, drawn in the browser on a <canvas> (no AI images, no server cost).
// 12 layouts, each in square (1080x1080) and story (1080x1920).
//
// - Text wraps and shrinks to fit its box, down to a minimum size. If it still doesn't fit,
//   that field is reported as "too long" and the editor blocks the download (never cut off).
// - Drawing waits for the Outfit font to load (see loadTemplateFonts), so the first download
//   never uses a fallback font.
// - Colors are the owner's brand colors (src/lib/brand.ts), not the app's design tokens.

import { textOn } from "./brand";
import { TEMPLATE_SIZES, type TemplateSize, type TemplateText } from "./content";

export type TemplateField = keyof TemplateText;

export type TemplateInfo = {
  id: string;
  name: string;
  /** Fields the owner can edit on this layout */
  fields: TemplateField[];
  /** Fields that must be filled before downloading (the owner's own words, or saved data) */
  required: TemplateField[];
};

export const TEMPLATES: TemplateInfo[] = [
  { id: "tip", name: "Tip card", fields: ["headline", "line"], required: ["headline"] },
  { id: "quote", name: "Quote card", fields: ["headline", "line"], required: ["headline"] },
  { id: "price", name: "Service and price", fields: ["headline", "price", "line"], required: ["headline", "price"] },
  { id: "open_week", name: "Open this week", fields: ["headline", "days", "line"], required: ["days"] },
  { id: "special", name: "Special offer", fields: ["offer", "line"], required: ["offer"] },
  { id: "testimonial", name: "Testimonial", fields: ["quote", "line"], required: ["quote"] },
  { id: "countdown", name: "Launch countdown", fields: ["countdown", "headline", "line"], required: ["countdown"] },
  { id: "behind", name: "Behind the scenes", fields: ["headline", "line"], required: ["headline"] },
  { id: "booking", name: "Now booking", fields: ["headline", "line"], required: [] },
  { id: "new_service", name: "New service", fields: ["headline", "price", "line"], required: ["headline"] },
  { id: "thanks", name: "Thank you", fields: ["headline", "line"], required: [] },
  { id: "headline", name: "Simple headline", fields: ["headline", "line"], required: ["headline"] },
];

export const FIELD_LABELS: Record<TemplateField, string> = {
  headline: "Headline",
  line: "Small line",
  quote: "Client's words (type them yourself)",
  offer: "Your offer (type it yourself)",
  price: "Price",
  days: "Open days",
  countdown: "Days until opening",
};

export type Brand = { primary: string; accent: string; name: string };

type Box = { x: number; y: number; w: number; h: number };
type TextBlock = {
  field?: TemplateField;
  text: string;
  /** In fractions of the canvas width/height */
  box: Box;
  /** Font sizes in px at 1080 wide */
  max: number;
  min: number;
  weight: 400 | 600 | 700;
  color: string;
  align?: CanvasTextAlign;
  /** Vertical position inside the box */
  valign?: "top" | "middle" | "bottom";
  upper?: boolean;
  lineHeight?: number;
};
type Shape =
  | { kind: "rect"; box: Box; color: string; radius?: number }
  | { kind: "circle"; cx: number; cy: number; r: number; color: string }
  | { kind: "frame"; box: Box; color: string; width: number; radius?: number };

let family = "Outfit";

/** Wait until Outfit (all weights we draw with) is loaded. Call before the first draw. */
export async function loadTemplateFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  // next/font gives the family a generated name; read it from the CSS variable.
  const declared = getComputedStyle(document.documentElement).getPropertyValue("--font-outfit").trim();
  family = declared.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") || "Outfit";
  await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 80px "${family}"`)));
  await document.fonts.ready;
}

export function templateFontReady(): boolean {
  return typeof document !== "undefined" && document.fonts.check(`600 80px "${family}"`);
}

const font = (weight: number, size: number) => `${weight} ${size}px "${family}", sans-serif`;

/** Word-wrap `text` at `size`. Returns null if a single word is wider than the box. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] | null {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (ctx.measureText(word).width > width) return null;
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Largest size from max down to min (steps of 2) where the text fits the box, or null. */
function fit(ctx: CanvasRenderingContext2D, b: TextBlock, W: number, H: number) {
  const scale = W / 1080;
  const box = { x: b.box.x * W, y: b.box.y * H, w: b.box.w * W, h: b.box.h * H };
  const text = b.upper ? b.text.toUpperCase() : b.text;
  const lh = b.lineHeight ?? 1.12;
  // Text the owner doesn't edit here (the business-name wordmark, labels) must always appear:
  // it keeps shrinking past its normal minimum instead of ever being left out.
  const min = b.field ? b.min : 8;
  for (let size = b.max; size >= min; size -= b.field || size > b.min ? 2 : 1) {
    const px = Math.round(size * scale);
    ctx.font = font(b.weight, px);
    const lines = wrap(ctx, text, box.w);
    if (lines && lines.length * px * lh <= box.h) return { lines, px, box, lh };
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Mix a color with white (amount 0-1). */
function tint(hex: string, amount: number): string {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v + (255 - v) * amount).toString(16).padStart(2, "0")).join("")}`;
}

/** The blocks and shapes for one layout. Story layouts reuse the same design, stretched. */
function layout(id: string, t: TemplateText, brand: Brand, story: boolean): { bg: string; shapes: Shape[]; blocks: TextBlock[] } {
  const P = brand.primary;
  const A = brand.accent;
  const cream = tint(A, 0.75);
  const onP = textOn(P);
  const onA = textOn(A);
  const onC = textOn(cream);
  const top = story ? 0.14 : 0.1;
  const name = (color: string): TextBlock => ({ text: brand.name, box: { x: 0.08, y: story ? 0.88 : 0.86, w: 0.84, h: 0.06 }, max: 40, min: 24, weight: 600, color, align: "left", valign: "middle" });
  const label = (text: string, color: string, bg: string): [Shape, TextBlock] => [
    { kind: "rect", box: { x: 0.08, y: top, w: 0.42, h: 0.065 * (story ? 0.6 : 1) }, color: bg, radius: 40 },
    { text, box: { x: 0.1, y: top, w: 0.38, h: 0.065 * (story ? 0.6 : 1) }, max: 34, min: 22, weight: 600, color: textOn(bg), align: "left", valign: "middle", upper: true },
  ];
  const head = (field: TemplateField, text: string | undefined, color: string, box: Box, max = 104, min = 48, align: CanvasTextAlign = "left"): TextBlock => ({
    field,
    text: text ?? "",
    box,
    max,
    min,
    weight: 600,
    color,
    align,
    valign: "middle",
    lineHeight: 1.08,
  });
  const small = (text: string | undefined, color: string, box: Box, align: CanvasTextAlign = "left"): TextBlock => ({ field: "line", text: text ?? "", box, max: 46, min: 28, weight: 400, color, align, valign: "top", lineHeight: 1.25 });
  const body = story ? { y: 0.3, h: 0.34 } : { y: 0.24, h: 0.4 };
  const under = story ? 0.66 : 0.66;

  switch (id) {
    case "tip": {
      const [s, l] = label("Quick tip", P, A);
      return { bg: P, shapes: [s], blocks: [l, head("headline", t.headline, onP, { x: 0.08, y: body.y, w: 0.84, h: body.h }), small(t.line, onP, { x: 0.08, y: under, w: 0.84, h: 0.16 }), name(onP)] };
    }
    case "quote":
      return {
        bg: A,
        shapes: [],
        blocks: [
          { text: "“", box: { x: 0.08, y: top - 0.02, w: 0.3, h: 0.16 }, max: 220, min: 160, weight: 700, color: P, align: "left", valign: "top", lineHeight: 1 },
          head("headline", t.headline, onA, { x: 0.08, y: body.y, w: 0.84, h: body.h }, 92, 44),
          small(t.line, onA, { x: 0.08, y: under, w: 0.84, h: 0.14 }),
          name(onA),
        ],
      };
    case "price": {
      const [s, l] = label("Book now", A, P === A ? cream : A);
      return {
        bg: P,
        shapes: [s],
        blocks: [
          l,
          head("headline", t.headline, onP, { x: 0.08, y: story ? 0.24 : 0.2, w: 0.84, h: story ? 0.16 : 0.2 }, 90, 44),
          { field: "price", text: t.price ?? "", box: { x: 0.08, y: story ? 0.42 : 0.42, w: 0.84, h: story ? 0.14 : 0.2 }, max: 150, min: 64, weight: 700, color: A, align: "left", valign: "middle", lineHeight: 1 },
          small(t.line, onP, { x: 0.08, y: under, w: 0.84, h: 0.14 }),
          name(onP),
        ],
      };
    }
    case "open_week":
      return {
        bg: cream,
        shapes: [{ kind: "rect", box: { x: 0.06, y: story ? 0.36 : 0.38, w: 0.88, h: story ? 0.2 : 0.24 }, color: P, radius: 36 }],
        blocks: [
          head("headline", t.headline || "Open spots this week", onC, { x: 0.08, y: top, w: 0.84, h: story ? 0.2 : 0.24 }, 96, 44),
          { field: "days", text: t.days ?? "", box: { x: 0.1, y: story ? 0.37 : 0.4, w: 0.8, h: story ? 0.18 : 0.2 }, max: 84, min: 36, weight: 600, color: onP, align: "center", valign: "middle" },
          small(t.line, onC, { x: 0.08, y: under, w: 0.84, h: 0.14 }),
          name(onC),
        ],
      };
    case "special": {
      const [s, l] = label("Special", P, A);
      return {
        bg: P,
        shapes: [s, { kind: "frame", box: { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }, color: A, width: 6, radius: 28 }],
        blocks: [l, head("offer", t.offer, onP, { x: 0.08, y: body.y, w: 0.84, h: body.h }, 110, 48), small(t.line, onP, { x: 0.08, y: under, w: 0.84, h: 0.14 }), name(onP)],
      };
    }
    case "testimonial":
      return {
        bg: cream,
        shapes: [{ kind: "circle", cx: 0.86, cy: 0.12, r: 0.1, color: A }],
        blocks: [
          { text: "★★★★★", box: { x: 0.08, y: top, w: 0.6, h: 0.08 }, max: 64, min: 40, weight: 400, color: P, align: "left", valign: "middle" },
          head("quote", t.quote ? `“${t.quote}”` : "", onC, { x: 0.08, y: body.y, w: 0.84, h: body.h }, 80, 38),
          small(t.line || "A happy client", onC, { x: 0.08, y: under, w: 0.84, h: 0.12 }),
          name(onC),
        ],
      };
    case "countdown":
      return {
        bg: P,
        shapes: [{ kind: "circle", cx: 0.5, cy: story ? 0.36 : 0.36, r: story ? 0.2 : 0.22, color: A }],
        blocks: [
          { field: "countdown", text: t.countdown ?? "", box: { x: 0.3, y: story ? 0.27 : 0.2, w: 0.4, h: story ? 0.14 : 0.24 }, max: 240, min: 90, weight: 700, color: onA, align: "center", valign: "middle", lineHeight: 1 },
          { text: "days", box: { x: 0.3, y: story ? 0.42 : 0.44, w: 0.4, h: 0.06 }, max: 44, min: 28, weight: 600, color: onA, align: "center", valign: "middle" },
          head("headline", t.headline || "until we open", onP, { x: 0.08, y: story ? 0.6 : 0.62, w: 0.84, h: story ? 0.12 : 0.14 }, 80, 40, "center"),
          small(t.line, onP, { x: 0.08, y: story ? 0.73 : 0.77, w: 0.84, h: 0.08 }, "center"),
          name(onP),
        ],
      };
    case "behind":
      return {
        bg: A,
        shapes: [{ kind: "rect", box: { x: 0, y: story ? 0.62 : 0.6, w: 1, h: story ? 0.38 : 0.4 }, color: P }],
        blocks: [
          { text: "Behind the scenes", box: { x: 0.08, y: top, w: 0.84, h: 0.06 }, max: 38, min: 24, weight: 600, color: onA, align: "left", valign: "middle", upper: true },
          head("headline", t.headline, onA, { x: 0.08, y: story ? 0.22 : 0.2, w: 0.84, h: story ? 0.36 : 0.36 }, 100, 46),
          small(t.line, onP, { x: 0.08, y: story ? 0.66 : 0.65, w: 0.84, h: 0.16 }),
          name(onP),
        ],
      };
    case "booking":
      return {
        bg: A,
        shapes: [{ kind: "rect", box: { x: 0.08, y: story ? 0.44 : 0.47, w: 0.2, h: 0.012 }, color: P }],
        blocks: [
          { text: "Now booking", box: { x: 0.08, y: top, w: 0.84, h: story ? 0.28 : 0.34 }, max: 170, min: 80, weight: 700, color: onA, align: "left", valign: "middle", lineHeight: 1 },
          head("headline", t.headline, onA, { x: 0.08, y: story ? 0.48 : 0.52, w: 0.84, h: story ? 0.14 : 0.16 }, 72, 36),
          small(t.line, onA, { x: 0.08, y: under + 0.04, w: 0.84, h: 0.12 }),
          name(onA),
        ],
      };
    case "new_service": {
      const [s, l] = label("New", P, A);
      return {
        bg: P,
        shapes: [s],
        blocks: [l, head("headline", t.headline, onP, { x: 0.08, y: body.y, w: 0.84, h: body.h * 0.7 }, 104, 46), { field: "price", text: t.price ?? "", box: { x: 0.08, y: body.y + body.h * 0.72, w: 0.84, h: body.h * 0.28 }, max: 80, min: 36, weight: 600, color: A, align: "left", valign: "middle" }, small(t.line, onP, { x: 0.08, y: under, w: 0.84, h: 0.14 }), name(onP)],
      };
    }
    case "thanks":
      return {
        bg: cream,
        shapes: [{ kind: "circle", cx: 0.5, cy: story ? 0.24 : 0.24, r: 0.07, color: A }],
        blocks: [
          { text: "Thank you", box: { x: 0.08, y: story ? 0.33 : 0.34, w: 0.84, h: story ? 0.12 : 0.16 }, max: 140, min: 70, weight: 700, color: P, align: "center", valign: "middle", lineHeight: 1 },
          head("headline", t.headline, onC, { x: 0.08, y: story ? 0.47 : 0.52, w: 0.84, h: story ? 0.12 : 0.14 }, 64, 34, "center"),
          small(t.line, onC, { x: 0.08, y: story ? 0.6 : 0.68, w: 0.84, h: 0.12 }, "center"),
          { ...name(onC), align: "center" },
        ],
      };
    default:
      return {
        bg: P,
        shapes: [{ kind: "rect", box: { x: 0.08, y: story ? 0.62 : 0.66, w: 0.14, h: 0.01 }, color: A }],
        blocks: [head("headline", t.headline, onP, { x: 0.08, y: top, w: 0.84, h: story ? 0.5 : 0.54 }, 130, 54), small(t.line, onP, { x: 0.08, y: story ? 0.65 : 0.69, w: 0.84, h: 0.12 }), name(onP)],
      };
  }
}

export type DrawResult = {
  /** Fields whose text doesn't fit even at the smallest size */
  tooLong: TemplateField[];
  /** Required fields that are empty */
  missing: TemplateField[];
};

/** Draw a template onto `canvas` at full size. Call loadTemplateFonts() first. */
export function drawTemplate(canvas: HTMLCanvasElement, id: string, size: TemplateSize, text: TemplateText, brand: Brand): DrawResult {
  const { w: W, h: H } = TEMPLATE_SIZES[size];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const info = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  const missing = info.required.filter((f) => !(text[f] ?? "").trim());
  if (!ctx) return { tooLong: [], missing };
  const { bg, shapes, blocks } = layout(info.id, text, brand, size === "story");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const s of shapes) {
    ctx.fillStyle = s.color;
    if (s.kind === "rect") {
      roundRect(ctx, s.box.x * W, s.box.y * H, s.box.w * W, s.box.h * H, (s.radius ?? 0) * (W / 1080));
      ctx.fill();
    } else if (s.kind === "circle") {
      ctx.beginPath();
      ctx.arc(s.cx * W, s.cy * H, s.r * W, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      roundRect(ctx, s.box.x * W, s.box.y * H, s.box.w * W, s.box.h * H, (s.radius ?? 0) * (W / 1080));
      ctx.stroke();
    }
  }

  const tooLong: TemplateField[] = [];
  ctx.textBaseline = "alphabetic";
  for (const b of blocks) {
    if (!b.text.trim()) continue;
    const f = fit(ctx, b, W, H);
    if (!f) {
      if (b.field && !tooLong.includes(b.field)) tooLong.push(b.field);
      continue; // never draw cut-off text
    }
    ctx.font = font(b.weight, f.px);
    ctx.fillStyle = b.color;
    ctx.textAlign = b.align ?? "left";
    const blockH = f.lines.length * f.px * f.lh;
    const startY = b.valign === "middle" ? f.box.y + (f.box.h - blockH) / 2 : b.valign === "bottom" ? f.box.y + f.box.h - blockH : f.box.y;
    const x = b.align === "center" ? f.box.x + f.box.w / 2 : b.align === "right" ? f.box.x + f.box.w : f.box.x;
    f.lines.forEach((line, i) => ctx.fillText(line, x, startY + f.px * (i + 0.86) + (f.px * (f.lh - 1)) * i));
  }
  return { tooLong, missing };
}

/** The finished PNG as a File. */
export function templateFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: "image/png" })) : reject(new Error("no image"))), "image/png"),
  );
}

/**
 * Save the image. On phones (iPhone Safari included) open the share sheet so they can tap
 * "Save Image". Otherwise download it. If neither works, open the image in a new tab.
 */
export async function saveImage(file: File): Promise<"shared" | "downloaded" | "opened"> {
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared"; // they closed the share sheet
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  if ("download" in a && !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "downloaded";
  }
  window.open(url, "_blank");
  return "opened";
}
