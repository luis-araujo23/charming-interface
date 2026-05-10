import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { BookOpen, Calendar, Users, Tag, Sparkles, Search, Flame, LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const navItems = [
  { to: "/diary", label: "Diario", icon: BookOpen },
  { to: "/calendar", label: "Calendario", icon: Calendar },
  { to: "/search", label: "Buscar", icon: Search },
  { to: "/friends", label: "Amigos", icon: Users },
  { to: "/tagged", label: "Etiquetado", icon: Tag },
  { to: "/memories", label: "Recuerdos", icon: Sparkles },
  { to: "/streaks", label: "Racha", icon: Flame },
] as const;

type AppSidebarProps = {
  hasFriendNotifications?: boolean;
  hasTaggedNotifications?: boolean;
  completedWeeklyStreaksCount?: number;
};

export function AppSidebar({
  hasFriendNotifications = false,
  hasTaggedNotifications = false,
  completedWeeklyStreaksCount = 0,
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      await navigate({ to: "/login" });
      setLoggingOut(false);
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-cream/50 p-6 backdrop-blur-sm md:flex">
      <Link to="/diary" className="mb-10">
        <Logo size="sm" />
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {active && (
                <motion.span
                  layoutId="active-nav"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-olive-deep" : ""}`} />
              <span className={`relative z-10 ${active ? "text-foreground" : ""}`}>{item.label}</span>
              {item.to === "/friends" && hasFriendNotifications ? (
                <span className="relative z-10 ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Tienes solicitudes de amistad pendientes" />
              ) : null}
              {item.to === "/tagged" && hasTaggedNotifications ? (
                <span className="relative z-10 ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-red-500" aria-label="Tienes nuevas notas etiquetadas" />
              ) : null}
              {item.to === "/streaks" && completedWeeklyStreaksCount > 0 ? (
                <span
                  className="relative z-10 ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                  aria-label={`Tienes ${completedWeeklyStreaksCount} rachas semanales completas`}
                >
                  {completedWeeklyStreaksCount > 99 ? "99+" : completedWeeklyStreaksCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        {loggingOut ? "Cerrando..." : "Cerrar sesión"}
      </button>
    </aside>
  );
}
