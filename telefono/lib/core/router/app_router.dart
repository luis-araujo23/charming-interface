import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/widgets/main_layout.dart';
import 'package:telefono/features/auth/presentation/screens/login_screen.dart';
import 'package:telefono/features/auth/presentation/screens/register_screen.dart';
import 'package:telefono/features/diary/presentation/screens/diary_screen.dart';
import 'package:telefono/features/diary/presentation/screens/calendar_screen.dart';
import 'package:telefono/features/diary/presentation/screens/search_screen.dart';
import 'package:telefono/features/friends/presentation/screens/friends_screen.dart';
import 'package:telefono/features/diary/presentation/screens/tagged_screen.dart';
import 'package:telefono/features/memories/presentation/screens/memories_screen.dart';
import 'package:telefono/features/diary/presentation/screens/add_entry_screen.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/login',
  debugLogDiagnostics: true,
  routes: [
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/register',
      name: 'register',
      builder: (context, state) => const RegisterScreen(),
    ),
    GoRoute(
      path: '/add-entry',
      name: 'add-entry',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) {
        final entry = state.extra as DiaryEntryModel?;
        return AddEntryScreen(entry: entry);
      },
    ),
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return MainLayout(navigationShell: navigationShell);
      },
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/diary',
              name: 'diary',
              builder: (context, state) => const DiaryScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/calendar',
              name: 'calendar',
              builder: (context, state) => const CalendarScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/search',
              name: 'search',
              builder: (context, state) => const SearchScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/friends',
              name: 'friends',
              builder: (context, state) => const FriendsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/tagged',
              name: 'tagged',
              builder: (context, state) => const TaggedScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/memories',
              name: 'memories',
              builder: (context, state) => const MemoriesScreen(),
            ),
          ],
        ),
      ],
    ),
  ],
);
