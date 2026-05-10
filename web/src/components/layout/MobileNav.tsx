import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Calendar, Users, Sparkles, Search, Tag } from "lucide-react";

const items = [
  { to: "/diary", label: "Diario", icon: BookOpen },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/friends", label: "Amigos", icon: Users },
  { to: "/tagged", label: "Etiquetado", icon: Tag },
  { to: "/memories", label: "Recuerdos", icon: Sparkles },
] as const;

type MobileNavProps = {
  hasFriendNotifications?: boolean;
  hasTaggedNotifications?: boolean;
  completedWeeklyStreaksCount?: number;
};

export function MobileNav({
  hasFriendNotifications = false,
  hasTaggedNotifications = false,
  completedWeeklyStreaksCount = 0,
}: MobileNavProps) {
  const location = useLocation();
  void completedWeeklyStreaksCount;
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
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {item.to === "/friends" && hasFriendNotifications ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Tienes solicitudes de amistad pendientes" />
                  ) : null}
                  {item.to === "/tagged" && hasTaggedNotifications ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Tienes nuevas notas etiquetadas" />
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
