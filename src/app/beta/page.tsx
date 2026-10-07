import type { Metadata } from "next";
import { BetaPage } from "./BetaPage";

// Public beta sign-up. No login. Shared on LinkedIn, so most visitors are on a phone.
// The link preview image is ./opengraph-image.tsx.

const title = "Join the Second beta: be one of the first 25 businesses";
const description =
  "Second is a business partner in your pocket for small local businesses. It drafts the emails, posts, and plans, and you just say yes. Starting at the Jersey Shore.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/beta" },
  openGraph: { title, description, url: "/beta", siteName: "Second", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function Page() {
  return <BetaPage />;
}
