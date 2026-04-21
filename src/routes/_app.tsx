import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 px-5 pb-24 pt-6 md:px-10 md:pb-10 md:pt-8">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
