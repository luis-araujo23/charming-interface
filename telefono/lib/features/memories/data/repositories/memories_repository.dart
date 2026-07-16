import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/utils/logger.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/memories/data/models/memory_model.dart';

class MemoriesRepository {
  final _client = Supabase.instance.client;

  /// Recuerdos guardados por el usuario actual, ordenados del mas reciente al
  /// mas antiguo (el RPC ya los ordena). Usa un RPC SECURITY DEFINER porque la
  /// lectura directa de remembered_entries/diary_entries depende de RLS.
  Future<List<MemoryModel>> getMemories() async {
    try {
      final response = await _client.rpc('get_my_memories');
      if (response is List) {
        return response
            .map((e) => MemoryModel.fromMap(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
      return [];
    } catch (e, stack) {
      AppLogger.error('MemoriesRepository: Error en getMemories', e, stack);
      rethrow;
    }
  }

  /// Guarda un fragmento de una entrada propia como recuerdo.
  Future<MemoryModel> addMemory(int entryId, String selectedText) async {
    try {
      final response = await _client.rpc('add_memory', params: {
        'p_entry_id': entryId,
        'p_selected_text': selectedText,
      });
      return MemoryModel.fromMap(Map<String, dynamic>.from(response as Map));
    } catch (e, stack) {
      AppLogger.error('MemoriesRepository: Error en addMemory', e, stack);
      rethrow;
    }
  }

  /// Elimina uno de mis recuerdos.
  Future<void> deleteMemory(int memoryId) async {
    try {
      await _client.rpc('delete_memory', params: {
        'p_memory_id': memoryId,
      });
    } catch (e, stack) {
      AppLogger.error('MemoriesRepository: Error en deleteMemory', e, stack);
      rethrow;
    }
  }
}

final memoriesRepositoryProvider = Provider((ref) => MemoriesRepository());

/// Lista de recuerdos del usuario ACTUAL. Depende de `currentUserProvider` para
/// recargarse al cambiar de sesion y no servir datos de otra cuenta.
final memoriesProvider = FutureProvider<List<MemoryModel>>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];
  return ref.read(memoriesRepositoryProvider).getMemories();
});
