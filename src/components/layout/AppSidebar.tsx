import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
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

export function AppSidebar() {
  const location = useLocation();

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
            </Link>
          );
        })}
      </nav>

      <Link
        to="/"
        className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Link>
    </aside>
  );
}
