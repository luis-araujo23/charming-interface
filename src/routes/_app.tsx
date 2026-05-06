import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { getSeenIncomingFriendRequestIds } from "@/lib/friend-notifications";
import { getSeenTaggedNoteIds } from "@/lib/tagged-notifications";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingTaggedNotesCount, setPendingTaggedNotesCount] = useState(0);
  const [completedWeeklyStreaksCount, setCompletedWeeklyStreaksCount] = useState(0);

  const refreshFriendsNotifications = async () => {
    try {
      const response = await fetch("/api/friends");
      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        pendingRequests?: Array<{ friendshipId?: unknown }>;
      };

      const pendingIds = Array.isArray(data.pendingRequests)
        ? data.pendingRequests
          .map((request) => Number(request.friendshipId))
          .filter((id) => Number.isInteger(id) && id > 0)
        : [];

      const seenIds = getSeenIncomingFriendRequestIds();
      const unreadCount = pendingIds.filter((id) => !seenIds.has(id)).length;
      setPendingRequestsCount(unreadCount);
    } catch {
    }
  };

  const refreshTaggedNotifications = async () => {
    try {
      const response = await fetch("/api/tagged");
      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        notes?: Array<{ entryTagId?: unknown }>;
      };

      const noteIds = Array.isArray(data.notes)
        ? data.notes
          .map((note) => Number(note.entryTagId))
          .filter((id) => Number.isInteger(id) && id > 0)
        : [];

      const seenIds = getSeenTaggedNoteIds();
      const unreadCount = noteIds.filter((id) => !seenIds.has(id)).length;
      setPendingTaggedNotesCount(unreadCount);
    } catch {
    }
  };

  const refreshStreaksSummary = async () => {
    try {
      const response = await fetch("/api/streaks");
      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        totalCompletedWeeks?: unknown;
      };

      const totalCompletedWeeks = Number(data.totalCompletedWeeks);
      setCompletedWeeklyStreaksCount(Number.isFinite(totalCompletedWeeks) ? totalCompletedWeeks : 0);
    } catch {
    }
  };

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session");

        if (!response.ok) {
          await navigate({ to: "/login" });
          return;
        }

        if (active) {
          setAuthorized(true);
          await refreshFriendsNotifications();
          await refreshTaggedNotifications();
          await refreshStreaksSummary();
        }
      } catch {
        await navigate({ to: "/login" });
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const onFriendsChanged = () => {
      void refreshFriendsNotifications();
    };

    const onTaggedChanged = () => {
      void refreshTaggedNotifications();
    };

    const onDiaryChanged = () => {
      void refreshStreaksSummary();
    };

    const onWindowFocus = () => {
      void refreshFriendsNotifications();
      void refreshTaggedNotifications();
      void refreshStreaksSummary();
    };

    window.addEventListener("friends:changed", onFriendsChanged);
    window.addEventListener("tagged:changed", onTaggedChanged);
    window.addEventListener("diary:changed", onDiaryChanged);
    window.addEventListener("focus", onWindowFocus);

    return () => {
      window.removeEventListener("friends:changed", onFriendsChanged);
      window.removeEventListener("tagged:changed", onTaggedChanged);
      window.removeEventListener("diary:changed", onDiaryChanged);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [authorized]);

  if (checkingSession || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-10">
        <p className="text-sm text-muted-foreground">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        hasFriendNotifications={pendingRequestsCount > 0}
        hasTaggedNotifications={pendingTaggedNotesCount > 0}
        completedWeeklyStreaksCount={completedWeeklyStreaksCount}
      />
      <main className="flex-1 px-5 pb-24 pt-6 md:px-10 md:pb-10 md:pt-8">
        <Outlet />
      </main>
      <MobileNav
        hasFriendNotifications={pendingRequestsCount > 0}
        hasTaggedNotifications={pendingTaggedNotesCount > 0}
        completedWeeklyStreaksCount={completedWeeklyStreaksCount}
      />
    </div>
  );
}
