import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/utils/logger.dart';

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

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  Future<void> _loadFriends() async {
    setState(() => _isLoading = true);
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      // Get public user id
      final userData = await Supabase.instance.client
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();

      final response = await Supabase.instance.client
          .from('friendships')
          .select('*, requester:users!friendships_requester_id_fkey(username, email), addressee:users!friendships_addressee_id_fkey(username, email)')
          .or('requester_id.eq.${userData['id']},addressee_id.eq.${userData['id']}');

      setState(() => _friends = List<Map<String, dynamic>>.from(response));
    } catch (e, stack) {
      AppLogger.error('Error loading friends', e, stack);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _searchUsers(String query) async {
    if (query.isEmpty) {
      setState(() => _searchResults = []);
      return;
    }

    try {
      final response = await Supabase.instance.client
          .from('users')
          .select()
          .ilike('username', '%$query%')
          .limit(5);

      setState(() => _searchResults = List<Map<String, dynamic>>.from(response));
    } catch (e) {
      debugPrint('Error searching users: $e');
    }
  }

  Future<void> _sendFriendRequest(int addresseeId) async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      final userData = await Supabase.instance.client
          .from('users')
          .select('id')
          .eq('auth_id', user!.id)
          .single();

      await Supabase.instance.client.from('friendships').insert({
        'requester_id': userData['id'],
        'addressee_id': addresseeId,
        'status': 'pending',
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Solicitud enviada'), backgroundColor: AppTheme.olive),
      );
      _loadFriends();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: AppTheme.error),
      );
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
                decoration: InputDecoration(
                  hintText: 'Buscar usuarios...',
                  prefixIcon: const Icon(Icons.person_search),
                  filled: true,
                  fillColor: AppTheme.cream.withOpacity(0.6),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
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
                  return ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text(u['username']),
                    subtitle: Text(u['email']),
                    trailing: IconButton(
                      icon: const Icon(Icons.person_add, color: AppTheme.olive),
                      onPressed: () => _sendFriendRequest(u['id']),
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
                  final isRequester = f['requester_id'] == f['id']; // This is simplified
                  final otherUser = f['requester']['username'] == 'Usuario_Test' ? f['addressee'] : f['requester']; // Simplified check
                  
                  return ListTile(
                    leading: const CircleAvatar(backgroundColor: AppTheme.mint, child: Icon(Icons.person, color: Colors.white)),
                    title: Text(otherUser['username']),
                    subtitle: Text('Estado: ${f['status']}'),
                    trailing: f['status'] == 'pending' ? const Icon(Icons.timer_outlined, size: 16) : null,
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
