import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/diary/presentation/widgets/diary_entry_card.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:intl/intl.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _searchController = TextEditingController();
  List<DiaryEntryModel> _results = [];
  bool _isLoading = false;

  Future<void> _performSearch(String query) async {
    if (query.isEmpty) {
      setState(() => _results = []);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      if (user == null) return;

      // Get public user id
      final userData = await Supabase.instance.client
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle();

      if (userData == null) {
        setState(() => _results = []);
        return;
      }

      final response = await Supabase.instance.client
          .from('diary_entries')
          .select()
          .eq('user_id', userData['id'] as int)
          .or('title.ilike.%$query%,content.ilike.%$query%')
          .order('entry_date', ascending: false);

      final List<DiaryEntryModel> entries = (response as List)
          .map((e) => DiaryEntryModel.fromJson(e))
          .toList();

      setState(() => _results = entries);
    } catch (e) {
      debugPrint('Error searching: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Buscar'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => _performSearch(val),
              decoration: InputDecoration(
                hintText: 'Escribe una palabra clave...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: AppTheme.cream.withOpacity(0.6),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
              ),
            ),
          ),
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: AppTheme.olive))
              : _results.isEmpty && _searchController.text.isNotEmpty
                ? const Center(child: Text('No se encontraron resultados'))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _results.length,
                    itemBuilder: (context, index) {
                      return DiaryEntryCard(entry: _results[index]);
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
