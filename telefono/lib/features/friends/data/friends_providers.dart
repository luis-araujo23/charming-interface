import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/utils/logger.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';

/// Cuenta las solicitudes de amistad pendientes que el usuario actual ha
/// RECIBIDO (es el addressee). Se usa para mostrar la burbuja de aviso en la
/// barra de navegacion. Devuelve 0 ante cualquier error para no romper la UI.
final pendingFriendRequestsCountProvider = FutureProvider<int>((ref) async {
  try {
    final client = Supabase.instance.client;
    final user = ref.watch(currentUserProvider);
    if (user == null) return 0;

    final userData = await client
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();

    if (userData == null) return 0;
    final myId = userData['id'] as int;

    final rpcResponse = await client.rpc('get_my_friendships');
    if (rpcResponse is! List) return 0;

    var count = 0;
    for (final row in rpcResponse) {
      final relation = Map<String, dynamic>.from(row as Map);
      final status = relation['status']?.toString();
      final addresseeId = relation['addressee_id'] as int?;
      if (status == 'pending' && addresseeId == myId) {
        count++;
      }
    }

    return count;
  } catch (e) {
    AppLogger.warn('pendingFriendRequestsCountProvider fallo: $e');
    return 0;
  }
});

/// Devuelve la lista de amigos ACEPTADOS del usuario actual como
/// mapas {id, username}, ordenados por username. Se usa para etiquetar
/// amigos al crear una entrada del diario. Devuelve [] ante cualquier error.
final acceptedFriendsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  try {
    final client = Supabase.instance.client;
    final user = ref.watch(currentUserProvider);
    if (user == null) return [];

    final userData = await client
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();

    if (userData == null) return [];
    final myId = userData['id'] as int;

    final rpcResponse = await client.rpc('get_my_friendships');
    if (rpcResponse is! List) return [];

    final result = <Map<String, dynamic>>[];
    for (final row in rpcResponse) {
      final relation = Map<String, dynamic>.from(row as Map);
      if (relation['status']?.toString() != 'accepted') continue;

      final requesterId = relation['requester_id'] as int?;
      final other = requesterId == myId ? relation['addressee'] : relation['requester'];
      if (other is Map) {
        final id = other['id'];
        final username = other['username']?.toString();
        if (id is int && username != null && username.isNotEmpty) {
          result.add({'id': id, 'username': username});
        }
      }
    }

    result.sort((a, b) =>
        (a['username'] as String).toLowerCase().compareTo((b['username'] as String).toLowerCase()));
    return result;
  } catch (e) {
    AppLogger.warn('acceptedFriendsProvider fallo: $e');
    return [];
  }
});
