import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { UserPlus, X, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { mockFriends, mockRequests } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Amigos" subtitle="Las personas con las que compartes tu diario" />

      <div className="relative mb-10">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar usuarios por nombre…"
          className="h-12 rounded-2xl border-border bg-cream/60 pl-11"
        />
      </div>

      {mockRequests.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Solicitudes pendientes
          </h2>
          <div className="space-y-3">
            {mockRequests.map((req, i) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="paper-card flex items-center justify-between rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-medium text-accent-foreground">
                    {req.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{req.name}</p>
                    <p className="text-xs text-muted-foreground">@{req.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="outline" className="h-9 w-9 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="icon" className="h-9 w-9 rounded-full bg-primary">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tus amigos · {mockFriends.length}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mockFriends.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="paper-card flex items-center gap-3 rounded-2xl p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-olive to-mint font-medium text-cream">
                {f.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <p className="truncate text-xs text-muted-foreground">@{f.username}</p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground">
                <UserPlus className="h-4 w-4" />
              </Button>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
