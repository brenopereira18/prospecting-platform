import { Sidebar } from "@/src/components/app-shell/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
