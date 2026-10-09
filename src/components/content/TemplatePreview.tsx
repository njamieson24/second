"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../Button";
import { TEMPLATE_SIZES, type TemplateSize, type TemplateText } from "@/lib/content";
import { drawTemplate, loadTemplateFonts, saveImage, templateFile, TEMPLATES, type Brand, type DrawResult } from "@/lib/templates";

/**
 * Live preview of a branded template, drawn at full size and scaled down with CSS.
 * Waits for the Outfit font before the first draw, so a download never uses a fallback font.
 */
export function TemplatePreview({
  template,
  size,
  text,
  brand,
  onResult,
  onDownloaded,
}: {
  template: string;
  size: TemplateSize;
  text: TemplateText;
  brand: Brand;
  onResult: (r: DrawResult) => void;
  onDownloaded?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [result, setResult] = useState<DrawResult>({ tooLong: [], missing: [] });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadTemplateFonts().then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);

  const report = useRef(onResult);
  useEffect(() => {
    report.current = onResult;
  });

  useEffect(() => {
    if (!fontsReady) return;
    // Draw on the next frame (the canvas is a DOM side effect), then report what didn't fit.
    const frame = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const r = drawTemplate(canvasRef.current, template, size, text, brand);
      setResult(r);
      report.current(r);
    });
    return () => cancelAnimationFrame(frame);
  }, [fontsReady, template, size, text, brand]);

  const blocked = !fontsReady || result.tooLong.length > 0 || result.missing.length > 0;
  const info = TEMPLATES.find((t) => t.id === template);
  const { w, h } = TEMPLATE_SIZES[size];

  async function download() {
    if (!canvasRef.current || blocked) return;
    setSaving(true);
    setNote(null);
    try {
      const name = `${(brand.name || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${template}-${size}.png`;
      const how = await saveImage(await templateFile(canvasRef.current, name));
      if (how === "opened") setNote("Your image opened in a new tab. Press and hold it to save it.");
      onDownloaded?.();
    } catch {
      setNote("We couldn't make the image. Please try again.");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto w-full overflow-hidden rounded-row border border-line bg-paper" style={{ maxWidth: size === "story" ? 300 : 460 }}>
        <canvas
          ref={canvasRef}
          width={w}
          height={h}
          className="block h-auto w-full"
          role="img"
          aria-label={`Preview of the ${info?.name ?? "post"} template`}
          data-template={template}
          data-size={size}
        />
      </div>
      {!fontsReady && <p className="m-0 text-center text-sm text-muted">Getting your template ready…</p>}
      <div className="flex flex-col items-center gap-1.5">
        <Button icon={<Download size={17} aria-hidden="true" />} onClick={download} disabled={blocked || saving}>
          {saving ? "Making your image…" : "Download image"}
        </Button>
        {result.tooLong.length > 0 && <p className="m-0 text-sm font-medium text-ink">Some text is too long for this template. Shorten it to download.</p>}
        {result.tooLong.length === 0 && result.missing.length > 0 && <p className="m-0 text-sm text-muted">Fill in the boxes marked “Add this first” to download.</p>}
        {note && <p className="m-0 text-center text-sm text-muted">{note}</p>}
      </div>
    </div>
  );
}
