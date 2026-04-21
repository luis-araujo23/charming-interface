import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Calendar, Users, Sparkles, Search } from "lucide-react";

const items = [
  { to: "/diary", label: "Diario", icon: BookOpen },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/friends", label: "Amigos", icon: Users },
  { to: "/memories", label: "Recuerdos", icon: Sparkles },
] as const;

export function MobileNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-cream/90 backdrop-blur-md md:hidden">
      <ul className="flex items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${
                  active ? "text-olive-deep" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
