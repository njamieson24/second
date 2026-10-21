import { redirect } from "next/navigation";

// Outreach is now Partners (shared by both modes).
export default function OldOutreachPage() {
  redirect("/partners");
}
