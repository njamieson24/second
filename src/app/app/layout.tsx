import { AppShell } from "@/components/AppShell";

export default function RunningLayout({ children }: LayoutProps<"/app">) {
  return <AppShell mode="running">{children}</AppShell>;
}
