"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, CalendarDays, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/plan", label: "Plány", icon: CalendarDays },
  { href: "/oblibene", label: "Oblíbené", icon: Heart },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 safe-area-bottom">
      <div className="flex items-stretch max-w-lg mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-xs font-medium transition-colors min-h-[56px]",
                isActive
                  ? "text-green-700"
                  : "text-stone-400 hover:text-stone-600"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-green-700" : "text-stone-400"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
