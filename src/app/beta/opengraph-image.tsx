import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The picture LinkedIn (and others) show when someone shares /beta. Made once at build time.
// This draws a PNG, not a web page, so CSS tokens don't apply here. The colors below
// are the light-mode tokens from docs/DESIGN.md.
const C = {
  paper: "#F7F8F5", // paper
  ink: "#151B26", // ink
  inkSoft: "#3B4250", // ink-soft
  sky: "#2A5BD7", // sky
  mint: "#3DDC97", // mint
  mintTint: "#E3F8EE", // mint-tint
  mintDeep: "#0F6B47", // mint-deep
  panel: "#EAF0FB", // panel
};

export const alt = "Second: be one of the first 25 businesses. Your business partner, in your pocket.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [semibold, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/Outfit-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/Outfit-Regular.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: C.paper,
          color: C.ink,
          fontFamily: "Outfit",
        }}
      >
        {/* A soft panel-blue circle in the corner, like the app's panels */}
        <div
          style={{
            position: "absolute",
            right: -160,
            top: -160,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: C.panel,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="88" height="56" viewBox="0 0 88 56">
            <circle cx="28" cy="28" r="24" fill={C.sky} />
            <circle cx="60" cy="28" r="21" fill="none" strokeWidth="12" stroke={C.paper} />
            <circle cx="60" cy="28" r="21" fill="none" strokeWidth="6" stroke={C.mint} />
          </svg>
          <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1 }}>second</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 20px",
              borderRadius: 14,
              background: C.mintTint,
              color: C.mintDeep,
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            Free beta · Starting at the Jersey Shore
          </div>
          <div style={{ fontSize: 74, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 1000 }}>
            Be one of the first 25 businesses on Second.
          </div>
        </div>

        {/* One word at a time: the image renderer spaces "Your business" unevenly otherwise. */}
        <div style={{ display: "flex", gap: 9, fontSize: 34, color: C.inkSoft }}>
          {"Your business partner, in your pocket.".split(" ").map((word, i) => (
            <span key={i}>{word}</span>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Outfit", data: semibold, style: "normal", weight: 600 },
        { name: "Outfit", data: regular, style: "normal", weight: 400 },
      ],
    },
  );
}
