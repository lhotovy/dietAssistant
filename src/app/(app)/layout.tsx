import { BottomNav } from "@/components/ui/bottom-nav";
import { UserSessionProvider } from "@/components/user-session-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserSessionProvider>
      <div className="flex flex-col h-dvh max-h-dvh min-h-0 max-w-lg mx-auto relative">
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-14">
          {children}
        </main>
        <BottomNav />
      </div>
    </UserSessionProvider>
  );
}
