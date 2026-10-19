import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { bootScript } from "@/lib/boot";
import { DataProvider } from "@/lib/data";
import { ThemeProvider } from "@/lib/theme";
import { TourProvider } from "@/components/Tour";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Full web address of the live site, so shared links get a working preview image.
// Not secret. Set NEXT_PUBLIC_SITE_URL in .env.local and in Vercel.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Shown in search results and link previews for the home page.
const description =
  "Second is an AI business partner for small businesses. It helps you start, run and grow, and soon connects you with local businesses to team up with.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Second",
  description,
  openGraph: { title: "Second: your business partner, in your pocket", description, siteName: "Second", type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <DataProvider>
            <TourProvider>{children}</TourProvider>
          </DataProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
