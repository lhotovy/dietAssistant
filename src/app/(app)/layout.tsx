import { BottomNav } from "@/components/ui/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto relative">
      <main className="flex-1 flex flex-col overflow-hidden pb-14">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
