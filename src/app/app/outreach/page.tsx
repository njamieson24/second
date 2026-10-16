import { redirect } from "next/navigation";

// Outreach moved to /outreach (shared by both modes).
export default function OldOutreachPage() {
  redirect("/outreach");
}
