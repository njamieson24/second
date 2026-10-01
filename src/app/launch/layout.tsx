import { AppShell } from "@/components/AppShell";

export default function LaunchLayout({ children }: LayoutProps<"/launch">) {
  return <AppShell mode="launch">{children}</AppShell>;
}
