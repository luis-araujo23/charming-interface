import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/utils/logger.dart';
import 'package:telefono/features/friends/data/friends_providers.dart';

class FriendsScreen extends ConsumerStatefulWidget {
  const FriendsScreen({super.key});

  @override
  ConsumerState<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends ConsumerState<FriendsScreen> {
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  List<Map<String, dynamic>> _friends = [];
  bool _isLoading = false;
  bool _isSearching = false;
  bool _isSending = false;
  final Set<int> _removingFriendIds = <int>{};
  final Set<int> _respondingFriendshipIds = <int>{};
  final Set<int> _cancelingFriendshipIds = <int>{};
  int? _currentUserPublicId;
  Timer? _searchDebounce;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<int?> _getCurrentUserPublicId() async {
    if (_currentUserPublicId != null) {
      return _currentUserPublicId;
    }

    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) {
      return null;
    }

    final userData = await Supabase.instance.client
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .order('id', ascending: false)
        .limit(1)
        .maybeSingle();

    if (userData == null) {
      return null;
    }

    _currentUserPublicId = userData['id'] as int;
    return _currentUserPublicId;
  }

  Map<String, dynamic>? _relationshipWith(int otherUserId) {
    final currentId = _currentUserPublicId;
    if (currentId == null) {
      return null;
    }

    for (final relation in _friends) {
      final requesterId = relation['requester_id'] as int?;
      final addresseeId = relation['addressee_id'] as int?;

      final matches = (requesterId == currentId && addresseeId == otherUserId)
          || (requesterId == otherUserId && addresseeId == currentId);

      if (matches) {
        return relation;
      }
    }

    return null;
  }

  Future<void> _loadFriends() async {
    setState(() => _isLoading = true);
    try {
      final currentId = await _getCurrentUserPublicId();
      if (currentId == null) {
        setState(() => _friends = []);
        return;
      }

      final rpcResponse = await Supabase.instance.client.rpc('get_my_friendships');
      final friends = rpcResponse is List
          ? List<Map<String, dynamic>>.from(
              rpcResponse.map((e) => Map<String, dynamic>.from(e as Map)),
            )
          : <Map<String, dynamic>>[];

      setState(() => _friends = friends);
      ref.invalidate(pendingFriendRequestsCountProvider);
    } catch (e, stack) {
      AppLogger.error('Error loading friends', e, stack);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No fue posible cargar tu lista de amigos: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _searchUsers(String query) async {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 320), () {
      _runUserSearch(query);
    });
  }

  Future<void> _runUserSearch(String query) async {
    final normalizedQuery = query.trim();
    if (normalizedQuery.isEmpty || normalizedQuery.length < 2) {
      setState(() => _searchResults = []);
      return;
    }

    setState(() => _isSearching = true);

    try {
      final currentId = await _getCurrentUserPublicId();
      List<Map<String, dynamic>> allResults = [];

      try {
        final rpcResponse = await Supabase.instance.client.rpc(
          'search_users_for_friend_request',
          params: {
            'p_query': normalizedQuery,
            'p_limit': 8,
          },
        );

        if (rpcResponse is List) {
          allResults = List<Map<String, dynamic>>.from(
            rpcResponse.map((e) => Map<String, dynamic>.from(e as Map)),
          );
        }
      } on PostgrestException {
        final response = await Supabase.instance.client
            .from('users')
            .select('id, username, email')
            .ilike('username', '%$normalizedQuery%')
            .limit(8);
        allResults = List<Map<String, dynamic>>.from(response);
      }

      final filteredResults = currentId == null
          ? allResults
          : allResults.where((user) => user['id'] != currentId).toList();

      setState(() => _searchResults = filteredResults);
    } catch (e) {
      AppLogger.error('Error searching users', e, StackTrace.current);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No fue posible buscar usuarios. Revisa politicas RLS o la funcion RPC.'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSearching = false);
      }
    }
  }

  Future<void> _sendFriendRequestByUsername() async {
    final username = _searchController.text.trim();
    if (username.isEmpty) {
      return;
    }

    setState(() => _isSending = true);
    try {
      try {
        final rpcResult = await Supabase.instance.client.rpc(
          'send_friend_request_by_username',
          params: {
            'p_username': username,
          },
        );

        final message = rpcResult is Map && rpcResult['message'] is String
            ? rpcResult['message'] as String
            : 'Solicitud enviada';

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message), backgroundColor: AppTheme.olive),
          );
        }
      } on PostgrestException catch (rpcError) {
        final message = (rpcError.message.isNotEmpty)
            ? rpcError.message
            : 'No se pudo enviar la solicitud';
        throw Exception(message);
      }

      _searchController.clear();
      setState(() => _searchResults = []);
      await _loadFriends();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  Future<void> _sendFriendRequestFromResult(Map<String, dynamic> userRow) async {
    final username = userRow['username']?.toString().trim() ?? '';
    if (username.isEmpty) {
      return;
    }

    _searchController.text = username;
    await _sendFriendRequestByUsername();
  }

  Future<void> _removeFriend(Map<String, dynamic> friendshipRow) async {
    final currentId = _currentUserPublicId;
    if (currentId == null) {
      return;
    }

    final requesterId = friendshipRow['requester_id'] as int?;
    final friendshipId = friendshipRow['id'] as int?;
    final otherUser = requesterId == currentId ? friendshipRow['addressee'] : friendshipRow['requester'];
    final otherUserId = otherUser is Map ? otherUser['id'] as int? : null;
    final otherUsername = otherUser is Map ? otherUser['username']?.toString() ?? 'este usuario' : 'este usuario';

    if (otherUserId == null || friendshipId == null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar amigo'),
        content: Text('Quieres eliminar a $otherUsername de tu lista de amigos?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Eliminar', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    setState(() => _removingFriendIds.add(otherUserId));
    try {
      final rpcResult = await Supabase.instance.client.rpc(
        'remove_friendship_with_user',
        params: {
          'p_other_user_id': otherUserId,
        },
      );

      final message = rpcResult is Map && rpcResult['message'] is String
          ? rpcResult['message'] as String
          : 'Amigo eliminado';

      if (mounted) {
        setState(() {
          _friends = _friends.where((row) {
            final rowId = row['id'] as int?;
            if (friendshipId != null && rowId == friendshipId) {
              return false;
            }

            final rowRequesterId = row['requester_id'] as int?;
            final rowAddresseeId = row['addressee_id'] as int?;
            final isSameRelation = (rowRequesterId == currentId && rowAddresseeId == otherUserId)
                || (rowRequesterId == otherUserId && rowAddresseeId == currentId);
            return !isSameRelation;
          }).toList();
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: AppTheme.olive),
        );
      }

      // Keep local UI responsive and then re-sync with backend.
      unawaited(_loadFriends());
    } on PostgrestException catch (dbError) {
      if (mounted) {
        final isRls = dbError.code == '42501';
        final missingRpc = dbError.code == 'PGRST202';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              missingRpc
                  ? 'Falta crear la funcion SQL remove_friendship_with_user. Ejecuta la migracion 2026-05-27_remove_friendship_rpc.sql.'
                  : isRls
                      ? 'No se pudo eliminar por politicas RLS. Ejecuta la migracion SQL 2026-05-27_remove_friendship_rpc.sql y vuelve a intentar.'
                      : 'Error al eliminar: ${dbError.message}',
            ),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al eliminar: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _removingFriendIds.remove(otherUserId));
      }
    }
  }

  Future<void> _cancelOutgoingRequest(Map<String, dynamic> friendshipRow) async {
    final currentId = _currentUserPublicId;
    final friendshipId = friendshipRow['id'] as int?;
    final requesterId = friendshipRow['requester_id'] as int?;
    final addresseeId = friendshipRow['addressee_id'] as int?;

    if (currentId == null ||
        friendshipId == null ||
        requesterId != currentId ||
        addresseeId == null) {
      return;
    }

    setState(() => _cancelingFriendshipIds.add(friendshipId));
    try {
      // Usa remove_friendship_with_user (ya desplegada) en lugar de
      // remove_friendship_by_id, que puede no existir en Supabase.
      await Supabase.instance.client.rpc(
        'remove_friendship_with_user',
        params: {'p_other_user_id': addresseeId},
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Solicitud cancelada.'),
            backgroundColor: AppTheme.olive,
          ),
        );
      }

      await _loadFriends();
    } on PostgrestException catch (dbError) {
      if (mounted) {
        final missingRpc = dbError.code == 'PGRST202';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              missingRpc
                  ? 'Falta crear la funcion SQL remove_friendship_with_user. Ejecuta la migracion 2026-05-27_remove_friendship_rpc.sql.'
                  : 'No se pudo cancelar la solicitud: ${dbError.message}',
            ),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _cancelingFriendshipIds.remove(friendshipId));
      }
    }
  }

  Future<void> _respondToRequest(Map<String, dynamic> friendshipRow, String action) async {
    final requesterId = friendshipRow['requester_id'] as int?;
    final friendshipId = friendshipRow['id'] as int?;
    if (requesterId == null || friendshipId == null) {
      return;
    }

    setState(() => _respondingFriendshipIds.add(friendshipId));
    try {
      final rpcResult = await Supabase.instance.client.rpc(
        'respond_friend_request',
        params: {
          'p_requester_id': requesterId,
          'p_action': action,
        },
      );

      final message = rpcResult is Map && rpcResult['message'] is String
          ? rpcResult['message'] as String
          : (action == 'accept' ? 'Solicitud aceptada' : 'Solicitud rechazada');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: AppTheme.olive),
        );
      }

      await _loadFriends();
    } on PostgrestException catch (dbError) {
      if (mounted) {
        final missingRpc = dbError.code == 'PGRST202';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              missingRpc
                  ? 'Falta crear la funcion SQL respond_friend_request. Ejecuta la migracion 2026-07-08_respond_friend_request_rpc.sql.'
                  : 'No se pudo responder la solicitud: ${dbError.message}',
            ),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _respondingFriendshipIds.remove(friendshipId));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Amigos')),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: TextField(
                controller: _searchController,
                onChanged: _searchUsers,
                onSubmitted: (_) => _sendFriendRequestByUsername(),
                decoration: InputDecoration(
                  hintText: 'Buscar por username...',
                  prefixIcon: const Icon(Icons.person_search),
                  suffixIcon: IconButton(
                    icon: _isSending
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.person_add_alt_1),
                    onPressed: _isSending ? null : _sendFriendRequestByUsername,
                    tooltip: 'Enviar solicitud por username',
                  ),
                  filled: true,
                  fillColor: AppTheme.cream.withOpacity(0.6),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
            if (_isSearching)
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: LinearProgressIndicator(minHeight: 2, color: AppTheme.olive),
              ),
            if (_searchResults.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text('RESULTADOS DE BÚSQUEDA', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
              ),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _searchResults.length,
                itemBuilder: (context, index) {
                  final u = _searchResults[index];
                  final relation = _relationshipWith(u['id'] as int);
                  final relationStatus = relation?['status']?.toString();
                  return ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text(u['username']),
                    subtitle: Text(u['email']),
                    trailing: relationStatus == null
                        ? IconButton(
                            icon: const Icon(Icons.person_add, color: AppTheme.olive),
                            onPressed: _isSending ? null : () => _sendFriendRequestFromResult(u),
                          )
                        : Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: relationStatus == 'accepted'
                                  ? AppTheme.mint.withOpacity(0.2)
                                  : AppTheme.olive.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              relationStatus == 'accepted' ? 'Amigo' : 'Pendiente',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                  );
                },
              ),
              const Divider(),
            ],
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('MIS AMIGOS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            ),
            if (_isLoading)
              const Center(child: CircularProgressIndicator(color: AppTheme.olive))
            else if (_friends.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Aún no tienes amigos añadidos')))
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _friends.length,
                itemBuilder: (context, index) {
                  final f = _friends[index];
                  final currentId = _currentUserPublicId;
                  final requesterId = f['requester_id'] as int?;
                  final addresseeId = f['addressee_id'] as int?;
                  final otherUser = requesterId == currentId ? f['addressee'] : f['requester'];
                  final otherUserId = otherUser is Map ? otherUser['id'] as int? : null;
                  final friendshipId = f['id'] as int?;
                  final status = f['status']?.toString() ?? 'pending';
                  final isRemoving = otherUserId != null && _removingFriendIds.contains(otherUserId);
                  final isResponding = friendshipId != null && _respondingFriendshipIds.contains(friendshipId);
                  final isIncomingPending =
                      status == 'pending' && currentId != null && addresseeId == currentId;
                  final isOutgoingPending =
                      status == 'pending' && currentId != null && requesterId == currentId;
                  final isCanceling = friendshipId != null && _cancelingFriendshipIds.contains(friendshipId);

                  final String subtitle;
                  if (status == 'accepted') {
                    subtitle = 'Amigo';
                  } else if (isIncomingPending) {
                    subtitle = 'Te envió una solicitud';
                  } else {
                    subtitle = 'Solicitud enviada';
                  }

                  final Widget trailing;
                  if (status == 'accepted') {
                    trailing = IconButton(
                      icon: isRemoving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.person_remove, color: AppTheme.error),
                      tooltip: 'Eliminar amigo',
                      onPressed: isRemoving ? null : () => _removeFriend(f),
                    );
                  } else if (isIncomingPending) {
                    trailing = isResponding
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.check_circle, color: AppTheme.olive),
                                tooltip: 'Aceptar solicitud',
                                onPressed: () => _respondToRequest(f, 'accept'),
                              ),
                              IconButton(
                                icon: const Icon(Icons.cancel, color: AppTheme.error),
                                tooltip: 'Rechazar solicitud',
                                onPressed: () => _respondToRequest(f, 'reject'),
                              ),
                            ],
                          );
                  } else if (isOutgoingPending) {
                    trailing = isCanceling
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : IconButton(
                            icon: const Icon(Icons.cancel_outlined, color: AppTheme.error),
                            tooltip: 'Cancelar solicitud',
                            onPressed: () => _cancelOutgoingRequest(f),
                          );
                  } else {
                    trailing = const Icon(Icons.timer_outlined, size: 16);
                  }

                  return ListTile(
                    leading: const CircleAvatar(backgroundColor: AppTheme.mint, child: Icon(Icons.person, color: Colors.white)),
                    title: Text(otherUser['username']?.toString() ?? 'Usuario'),
                    subtitle: Text(subtitle),
                    trailing: trailing,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
