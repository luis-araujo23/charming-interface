import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/utils/logger.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/streaks/data/models/streak_summary_model.dart';

class StreaksRepository {
  final _client = Supabase.instance.client;

  /// Racha semanal del usuario actual. Usa un RPC SECURITY DEFINER porque leer
  /// diary_entries / weekly_streaks directamente depende de RLS. El RPC ademas
  /// recalcula y guarda la racha de la semana en curso en cada llamada.
  Future<StreakSummary> getStreak() async {
    try {
      final response = await _client.rpc('get_my_streak');
      if (response is Map) {
        return StreakSummary.fromMap(Map<String, dynamic>.from(response));
      }
      return StreakSummary.empty();
    } catch (e, stack) {
      AppLogger.error('StreaksRepository: Error en getStreak', e, stack);
      rethrow;
    }
  }
}

final streaksRepositoryProvider = Provider((ref) => StreaksRepository());

/// Racha del usuario ACTUAL. Depende de `currentUserProvider` para recargarse al
/// cambiar de sesion y no servir datos cacheados de otra cuenta.
final streakProvider = FutureProvider<StreakSummary>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return StreakSummary.empty();
  return ref.read(streaksRepositoryProvider).getStreak();
});
