import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/core/utils/logger.dart';

class DiaryRepository {
  final _client = Supabase.instance.client;

  Future<List<DiaryEntryModel>> getEntries(int userId) async {
    try {
      final response = await _client
          .from('diary_entries')
          .select()
          .eq('user_id', userId)
          .order('entry_date', ascending: false);
      
      return (response as List).map((e) => DiaryEntryModel.fromJson(e)).toList();
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en getEntries', e, stack);
      rethrow;
    }
  }

  Future<void> createEntry(DiaryEntryModel entry) async {
    try {
      await _client.from('diary_entries').insert(entry.toJson(isInsert: true));
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en createEntry', e, stack);
      rethrow;
    }
  }

  Future<void> updateEntry(DiaryEntryModel entry) async {
    try {
      await _client
          .from('diary_entries')
          .update(entry.toJson(isInsert: true))
          .eq('id', entry.id);
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en updateEntry', e, stack);
      rethrow;
    }
  }

  Future<void> deleteEntry(int id) async {
    try {
      await _client.from('diary_entries').delete().eq('id', id);
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en deleteEntry', e, stack);
      rethrow;
    }
  }
}

final diaryRepositoryProvider = Provider((ref) => DiaryRepository());

final diaryEntriesProvider = FutureProvider<List<DiaryEntryModel>>((ref) async {
  final user = ref.watch(authRepositoryProvider).currentUser;
  if (user == null) return [];
  
  final userData = await Supabase.instance.client
      .from('users')
      .select('id')
      .eq('email', user.email!)
      .single();
  
  return ref.read(diaryRepositoryProvider).getEntries(userData['id'] as int);
});
