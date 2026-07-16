import 'dart:math';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/core/utils/logger.dart';

class DiaryRepository {
  final _client = Supabase.instance.client;

  static const String _photosBucket = 'diary-photos';

  Future<List<DiaryEntryModel>> getEntries(int userId) async {
    try {
      final response = await _client
          .from('diary_entries')
          .select()
          .eq('user_id', userId)
          .order('entry_date', ascending: false);

      final entries =
          (response as List).map((e) => DiaryEntryModel.fromJson(e)).toList();

      if (entries.isEmpty) return entries;

      final entryIds = entries.map((e) => e.id).toList();
      final photosByEntry = await _loadPhotos(entryIds);
      final tagsByEntry = await _loadTags(entryIds);
      final commentsByEntry = await _loadComments(entryIds);

      return entries
          .map((entry) => entry.copyWith(
                photoUrls: photosByEntry[entry.id] ?? const [],
                taggedUsers: tagsByEntry[entry.id] ?? const [],
                comments: commentsByEntry[entry.id] ?? const [],
              ))
          .toList();
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en getEntries', e, stack);
      rethrow;
    }
  }

  /// Carga las URLs de fotos por entrada. Es resiliente: ante cualquier error
  /// (p.ej. politicas RLS aun no aplicadas) devuelve un mapa vacio para no
  /// romper la carga del diario.
  Future<Map<int, List<String>>> _loadPhotos(List<int> entryIds) async {
    try {
      final rows = await _client
          .from('entry_photos')
          .select('entry_id, photo_url, created_at')
          .inFilter('entry_id', entryIds)
          .order('created_at', ascending: true);

      final map = <int, List<String>>{};
      for (final row in rows as List) {
        final entryId = row['entry_id'] as int;
        final url = row['photo_url'] as String?;
        if (url == null || url.isEmpty) continue;
        (map[entryId] ??= []).add(url);
      }
      return map;
    } catch (e, stack) {
      AppLogger.warn('DiaryRepository: no se pudieron cargar fotos. $e');
      AppLogger.error('DiaryRepository: _loadPhotos', e, stack);
      return {};
    }
  }

  /// Carga los usernames etiquetados por entrada. Usa un RPC SECURITY DEFINER
  /// (`get_entry_tags`) porque leer public.users de otros usuarios esta
  /// bloqueado por RLS, y una lectura directa devolveria usernames vacios.
  /// Si el RPC aun no existe, cae a un metodo directo en dos pasos.
  Future<Map<int, List<String>>> _loadTags(List<int> entryIds) async {
    try {
      final response = await _client.rpc('get_entry_tags', params: {
        'p_entry_ids': entryIds,
      });

      final map = <int, List<String>>{};
      if (response is List) {
        for (final row in response) {
          final data = Map<String, dynamic>.from(row as Map);
          final entryId = data['entry_id'] as int?;
          final username = data['username']?.toString();
          if (entryId == null || username == null || username.isEmpty) continue;
          (map[entryId] ??= []).add(username);
        }
      }
      return map;
    } on PostgrestException catch (e) {
      // PGRST202 => la funcion aun no fue creada; usar respaldo directo.
      if (e.code == 'PGRST202') {
        return _loadTagsFallback(entryIds);
      }
      AppLogger.warn('DiaryRepository: no se pudieron cargar etiquetas. $e');
      return {};
    } catch (e) {
      AppLogger.warn('DiaryRepository: no se pudieron cargar etiquetas. $e');
      return {};
    }
  }

  /// Respaldo si el RPC get_entry_tags no existe: lee entry_tags y luego users.
  /// (Puede devolver usernames vacios si la RLS de users lo impide.)
  Future<Map<int, List<String>>> _loadTagsFallback(List<int> entryIds) async {
    try {
      final tagRows = await _client
          .from('entry_tags')
          .select('entry_id, tagged_user_id, created_at')
          .inFilter('entry_id', entryIds)
          .order('created_at', ascending: true);

      final tags = tagRows as List;
      if (tags.isEmpty) return {};

      final userIds = <int>{
        for (final row in tags)
          if (row['tagged_user_id'] is int) row['tagged_user_id'] as int,
      };
      if (userIds.isEmpty) return {};

      final userRows = await _client
          .from('users')
          .select('id, username')
          .inFilter('id', userIds.toList());

      final usernameById = <int, String>{
        for (final row in userRows as List)
          row['id'] as int: (row['username']?.toString() ?? ''),
      };

      final map = <int, List<String>>{};
      for (final row in tags) {
        final entryId = row['entry_id'] as int;
        final userId = row['tagged_user_id'] as int?;
        final username = userId == null ? null : usernameById[userId];
        if (username == null || username.isEmpty) continue;
        (map[entryId] ??= []).add(username);
      }
      return map;
    } catch (e) {
      AppLogger.warn('DiaryRepository: fallback de etiquetas fallo. $e');
      return {};
    }
  }

  /// Carga los comentarios (respuestas) de las entradas propias del usuario,
  /// para que el dueño pueda leerlos en su diario. Usa el RPC get_entry_comments
  /// (SECURITY DEFINER). Resiliente: devuelve {} ante cualquier error.
  Future<Map<int, List<EntryComment>>> _loadComments(List<int> entryIds) async {
    try {
      final response = await _client.rpc('get_entry_comments', params: {
        'p_entry_ids': entryIds,
      });

      final map = <int, List<EntryComment>>{};
      if (response is List) {
        for (final row in response) {
          final data = Map<String, dynamic>.from(row as Map);
          final entryId = data['entry_id'] as int?;
          if (entryId == null) continue;
          (map[entryId] ??= []).add(EntryComment.fromMap(data));
        }
      }
      return map;
    } catch (e) {
      AppLogger.warn('DiaryRepository: no se pudieron cargar comentarios. $e');
      return {};
    }
  }

  /// Notas donde el usuario actual fue etiquetado, con fotos y comentarios.
  Future<List<Map<String, dynamic>>> getTaggedNotes() async {
    try {
      final response = await _client.rpc('get_tagged_notes');
      if (response is List) {
        return response
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      }
      return [];
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en getTaggedNotes', e, stack);
      rethrow;
    }
  }

  /// Agrega un comentario a una etiqueta (nota donde estoy etiquetado o que
  /// yo etiquete). Devuelve el comentario creado.
  Future<EntryComment> addTaggedComment(int entryTagId, String message) async {
    try {
      final response = await _client.rpc('add_tagged_comment', params: {
        'p_entry_tag_id': entryTagId,
        'p_message': message,
      });

      if (response is Map) {
        return EntryComment.fromMap(Map<String, dynamic>.from(response));
      }
      return EntryComment(authorUsername: '', message: message);
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en addTaggedComment', e, stack);
      rethrow;
    }
  }

  /// Crea la entrada y devuelve su id generado.
  Future<int> createEntry(DiaryEntryModel entry) async {
    try {
      final inserted = await _client
          .from('diary_entries')
          .insert(entry.toJson(isInsert: true))
          .select('id')
          .single();
      return inserted['id'] as int;
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en createEntry', e, stack);
      rethrow;
    }
  }

  /// Etiqueta amigos (por username) en una entrada propia. Solo se aceptan
  /// usuarios que existan y sean amigos aceptados (validado en el RPC).
  Future<void> attachTags(int entryId, List<String> usernames) async {
    final cleaned = usernames
        .map((u) => u.trim().toLowerCase())
        .where((u) => u.isNotEmpty)
        .toSet()
        .toList();
    if (cleaned.isEmpty) return;

    try {
      await _client.rpc('attach_entry_tags', params: {
        'p_entry_id': entryId,
        'p_usernames': cleaned,
      });
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en attachTags', e, stack);
      rethrow;
    }
  }

  /// Sube una imagen al bucket de Storage y registra su URL en la entrada.
  Future<void> uploadAndAttachPhoto({
    required int userId,
    required int entryId,
    required Uint8List bytes,
    required String fileName,
    required String contentType,
  }) async {
    try {
      final rawExt = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : '';
      final safeExt = (rawExt.isNotEmpty && rawExt.length <= 8) ? rawExt : 'jpg';
      final unique = '${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(1 << 32)}';
      final objectPath = 'users/$userId/entries/$entryId/$unique.$safeExt';

      await _client.storage.from(_photosBucket).uploadBinary(
            objectPath,
            bytes,
            fileOptions: FileOptions(contentType: contentType, upsert: false),
          );

      final publicUrl = _client.storage.from(_photosBucket).getPublicUrl(objectPath);

      await _client.rpc('attach_entry_photo', params: {
        'p_entry_id': entryId,
        'p_photo_url': publicUrl,
      });
    } catch (e, stack) {
      AppLogger.error('DiaryRepository: Error en uploadAndAttachPhoto', e, stack);
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
  // Depende del usuario ACTUAL: al cambiar de sesion se recalcula y nunca
  // devuelve las notas cacheadas de otra cuenta.
  final user = ref.watch(currentUserProvider);
  if (user == null) return [];

  final userData = await Supabase.instance.client
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

  if (userData == null) return [];

  return ref.read(diaryRepositoryProvider).getEntries(userData['id'] as int);
});
