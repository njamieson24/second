import { redirect } from "next/navigation";

// Outreach is now Partners (found -> emailed -> replied -> deal).
export default function OldOutreachPage() {
  redirect("/partners");
}
