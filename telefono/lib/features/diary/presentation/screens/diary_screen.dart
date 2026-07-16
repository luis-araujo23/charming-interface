import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/diary/presentation/widgets/diary_entry_card.dart';
import 'package:telefono/features/streaks/data/repositories/streaks_repository.dart';

class DiaryScreen extends ConsumerStatefulWidget {
  /// Si se navega con `/diary?entryId=123`, abre esa entrada en el PageView.
  final int? initialEntryId;

  const DiaryScreen({super.key, this.initialEntryId});

  @override
  ConsumerState<DiaryScreen> createState() => _DiaryScreenState();
}

class _DiaryScreenState extends ConsumerState<DiaryScreen> {
  late PageController _pageController;
  final ValueNotifier<int> _currentPage = ValueNotifier<int>(0);
  bool _isInitialized = false;
  int? _pendingEntryId;

  // Búsqueda inline desde la lupa del main (solo títulos → abre entrada completa).
  bool _isSearching = false;
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _pendingEntryId = widget.initialEntryId;
    _pageController.addListener(() {
      if (_pageController.hasClients) {
        _currentPage.value = _pageController.page?.round() ?? 0;
      }
    });
  }

  @override
  void didUpdateWidget(covariant DiaryScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialEntryId != null &&
        widget.initialEntryId != oldWidget.initialEntryId) {
      _pendingEntryId = widget.initialEntryId;
      _isInitialized = false;
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    _currentPage.dispose();
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _openSearch() {
    setState(() => _isSearching = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocus.requestFocus();
    });
  }

  void _closeSearch() {
    setState(() {
      _isSearching = false;
      _searchController.clear();
    });
    _searchFocus.unfocus();
  }

  void _jumpToEntry(List<DiaryEntryModel> chronologicalEntries, int entryId) {
    final index = chronologicalEntries.indexWhere((e) => e.id == entryId);
    if (index < 0) return;

    _closeSearch();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_pageController.hasClients) return;
      _pageController.jumpToPage(index);
      _currentPage.value = index;
    });
  }

  void _maybeJumpToPendingEntry(List<DiaryEntryModel> chronologicalEntries) {
    final targetId = _pendingEntryId;
    if (targetId == null) return;

    final index = chronologicalEntries.indexWhere((e) => e.id == targetId);
    if (index < 0) {
      _pendingEntryId = null;
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_pageController.hasClients) return;
      _pageController.jumpToPage(index);
      _currentPage.value = index;
      _pendingEntryId = null;
    });
  }

  Future<void> _logout(BuildContext context) async {
    try {
      await ref.read(authRepositoryProvider).signOut();
      if (mounted) context.go('/login');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al cerrar sesión: $e')),
        );
      }
    }
  }

  Widget _buildStreakAction() {
    final streakCount = ref.watch(streakProvider).maybeWhen(
          data: (s) => s.totalCompletedWeeks,
          orElse: () => 0,
        );

    final icon = IconButton(
      icon: const Icon(Icons.local_fire_department_outlined),
      tooltip: 'Tu racha',
      onPressed: () {
        ref.invalidate(streakProvider);
        context.push('/streaks');
      },
    );

    if (streakCount <= 0) return icon;

    return Badge(
      label: Text(
        streakCount > 99 ? '99+' : '$streakCount',
        style: const TextStyle(fontSize: 10),
      ),
      backgroundColor: AppTheme.olive,
      child: icon,
    );
  }

  Widget _buildTitleSearch(List<DiaryEntryModel> chronologicalEntries) {
    final query = _searchController.text.trim().toLowerCase();
    final matches = query.isEmpty
        ? <DiaryEntryModel>[]
        : chronologicalEntries.where((entry) {
            final title = (entry.title ?? '').toLowerCase();
            return title.contains(query);
          }).toList();

    return Material(
      elevation: 4,
      color: AppTheme.cream,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    focusNode: _searchFocus,
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'Buscar por título...',
                      isDense: true,
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.7),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppTheme.border),
                      ),
                    ),
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (value) {
                      if (matches.isNotEmpty) {
                        _jumpToEntry(chronologicalEntries, matches.first.id);
                      }
                    },
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: _closeSearch,
                  tooltip: 'Cerrar búsqueda',
                ),
              ],
            ),
          ),
          if (query.isNotEmpty)
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.35,
              ),
              child: matches.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('No hay entradas con ese título'),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: matches.length,
                      itemBuilder: (context, index) {
                        final entry = matches[index];
                        final title = entry.title?.trim().isNotEmpty == true
                            ? entry.title!.trim()
                            : 'Entrada sin título';
                        return ListTile(
                          dense: true,
                          title: Text(
                            title,
                            style: const TextStyle(fontFamily: 'Fraunces'),
                          ),
                          onTap: () => _jumpToEntry(chronologicalEntries, entry.id),
                        );
                      },
                    ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(diaryEntriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: _isSearching ? null : const Text('Kitty'),
        actions: [
          if (!_isSearching)
            _buildStreakAction(),
          if (!_isSearching)
            IconButton(
              icon: const Icon(Icons.search),
              tooltip: 'Buscar en el diario',
              onPressed: _openSearch,
            ),
          if (!_isSearching)
            IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => _logout(context),
              tooltip: 'Cerrar Sesión',
            ),
        ],
      ),
      body: entriesAsync.when(
        data: (entries) {
          if (entries.isEmpty) return _buildEmptyState(context);

          final chronologicalEntries = entries.reversed.toList();

          if (!_isInitialized) {
            _isInitialized = true;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (_pendingEntryId != null) {
                _maybeJumpToPendingEntry(chronologicalEntries);
              } else if (_pageController.hasClients) {
                final lastIndex = chronologicalEntries.length - 1;
                _pageController.jumpToPage(lastIndex);
                _currentPage.value = lastIndex;
              }
            });
          } else if (_pendingEntryId != null) {
            _maybeJumpToPendingEntry(chronologicalEntries);
          }

          return Column(
            children: [
              if (_isSearching) _buildTitleSearch(chronologicalEntries),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [
                        Colors.black.withOpacity(0.05),
                        Colors.transparent,
                        Colors.black.withOpacity(0.05),
                      ],
                    ),
                  ),
                  child: Column(
                    children: [
                      Expanded(
                        child: PageView.builder(
                          controller: _pageController,
                          itemCount: chronologicalEntries.length,
                          physics: const PageScrollPhysics(),
                          itemBuilder: (context, index) {
                            final entry = chronologicalEntries[index];
                            return Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24.0,
                                vertical: 24.0,
                              ),
                              child: SingleChildScrollView(
                                child: DiaryEntryCard(entry: entry),
                              ),
                            );
                          },
                        ),
                      ),
                      ValueListenableBuilder<int>(
                        valueListenable: _currentPage,
                        builder: (context, page, _) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 24.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.menu_book,
                                    size: 14, color: AppTheme.olive.withOpacity(0.5)),
                                const SizedBox(width: 8),
                                Text(
                                  'PÁGINA ${page + 1} DE ${chronologicalEntries.length}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.5,
                                    color: AppTheme.olive.withOpacity(0.7),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppTheme.olive)),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/add-entry'),
        backgroundColor: AppTheme.olive,
        child: const Icon(Icons.edit, color: Colors.white),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.book_outlined, size: 64, color: AppTheme.olive.withOpacity(0.3)),
          const SizedBox(height: 16),
          const Text(
            'Aún no hay entradas en Kitty',
            style: TextStyle(
                color: AppTheme.olive, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text('Empieza a escribir tu historia hoy.'),
        ],
      ),
    );
  }
}
