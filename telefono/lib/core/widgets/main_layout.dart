import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/features/diary/data/tagged_providers.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/friends/data/friends_providers.dart';

class MainLayout extends ConsumerStatefulWidget {
  final StatefulNavigationShell navigationShell;

  const MainLayout({
    super.key,
    required this.navigationShell,
  });

  @override
  ConsumerState<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends ConsumerState<MainLayout> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      ref.invalidate(pendingFriendRequestsCountProvider);
      ref.invalidate(unseenTaggedNotesCountProvider);
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Widget _iconWithDotBadge(IconData icon, int count) {
    final iconWidget = Icon(icon);
    if (count <= 0) return iconWidget;

    return Badge(
      backgroundColor: Colors.red,
      smallSize: 9,
      child: iconWidget,
    );
  }

  Future<void> _onTabSelected(int index) async {
    widget.navigationShell.goBranch(index);

    if (index == 3) {
      ref.invalidate(pendingFriendRequestsCountProvider);
    }

    // Al abrir Etiquetado, marcar todas como vistas y quitar la burbuja.
    if (index == 4) {
      try {
        final notes = await ref.read(diaryRepositoryProvider).getTaggedNotes();
        final ids = notes
            .map((n) => n['entryTagId'])
            .whereType<int>()
            .where((id) => id > 0)
            .toList();
        await markTaggedNotesAsSeen(ids);
      } catch (_) {
        // No bloquear la navegacion si falla el marcado.
      }
      ref.invalidate(unseenTaggedNotesCountProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pendingFriends = ref.watch(pendingFriendRequestsCountProvider).maybeWhen(
          data: (value) => value,
          orElse: () => 0,
        );
    final unseenTagged = ref.watch(unseenTaggedNotesCountProvider).maybeWhen(
          data: (value) => value,
          orElse: () => 0,
        );

    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppTheme.cream.withOpacity(0.9),
          border: const Border(
            top: BorderSide(color: AppTheme.border, width: 0.5),
          ),
        ),
        child: BottomNavigationBar(
          currentIndex: widget.navigationShell.currentIndex,
          onTap: _onTabSelected,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: AppTheme.oliveDeep,
          unselectedItemColor: AppTheme.olive.withOpacity(0.5),
          selectedLabelStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          items: [
            const BottomNavigationBarItem(
              icon: Icon(Icons.book_outlined),
              activeIcon: Icon(Icons.book),
              label: 'DIARIO',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today_outlined),
              activeIcon: Icon(Icons.calendar_today),
              label: 'CALENDARIO',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.search),
              activeIcon: Icon(Icons.search),
              label: 'BUSCAR',
            ),
            BottomNavigationBarItem(
              icon: _iconWithDotBadge(Icons.group_outlined, pendingFriends),
              activeIcon: _iconWithDotBadge(Icons.group, pendingFriends),
              label: 'AMIGOS',
            ),
            BottomNavigationBarItem(
              icon: _iconWithDotBadge(Icons.local_offer_outlined, unseenTagged),
              activeIcon: _iconWithDotBadge(Icons.local_offer, unseenTagged),
              label: 'ETIQUETADO',
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.auto_awesome_outlined),
              activeIcon: Icon(Icons.auto_awesome),
              label: 'RECUERDOS',
            ),
          ],
        ),
      ),
    );
  }
}
