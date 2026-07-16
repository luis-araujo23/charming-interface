import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:telefono/core/utils/logger.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';

const _seenTaggedNotesKey = 'tagged_seen_entry_tag_ids_v1';

Future<Set<int>> _getSeenTaggedNoteIds() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getStringList(_seenTaggedNotesKey) ?? const [];
  return raw.map(int.tryParse).whereType<int>().where((id) => id > 0).toSet();
}

/// Marca como vistas las notas etiquetadas indicadas (por entryTagId).
Future<void> markTaggedNotesAsSeen(List<int> entryTagIds) async {
  if (entryTagIds.isEmpty) return;
  final prefs = await SharedPreferences.getInstance();
  final seen = await _getSeenTaggedNoteIds();
  seen.addAll(entryTagIds.where((id) => id > 0));
  await prefs.setStringList(
    _seenTaggedNotesKey,
    seen.map((id) => id.toString()).toList(),
  );
}

/// Cuenta notas etiquetadas no vistas. Burbuja roja en la pestaña Etiquetado.
final unseenTaggedNotesCountProvider = FutureProvider<int>((ref) async {
  try {
    ref.watch(currentUserProvider);
    final notes = await ref.read(diaryRepositoryProvider).getTaggedNotes();
    final seen = await _getSeenTaggedNoteIds();

    var count = 0;
    for (final note in notes) {
      final entryTagId = note['entryTagId'];
      if (entryTagId is int && entryTagId > 0 && !seen.contains(entryTagId)) {
        count++;
      }
    }
    return count;
  } catch (e) {
    AppLogger.warn('unseenTaggedNotesCountProvider fallo: $e');
    return 0;
  }
});
