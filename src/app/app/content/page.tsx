import { redirect } from "next/navigation";

// Content moved to /content (shared by both modes).
export default function OldContentPage() {
  redirect("/content");
}
