import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

class AddEntryScreen extends ConsumerStatefulWidget {
  final DiaryEntryModel? entry;

  const AddEntryScreen({super.key, this.entry});

  @override
  ConsumerState<AddEntryScreen> createState() => _AddEntryScreenState();
}

class _AddEntryScreenState extends ConsumerState<AddEntryScreen> {
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _songUrlController = TextEditingController();
  final _songTitleController = TextEditingController();
  final _songArtistController = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.entry != null) {
      _titleController.text = widget.entry!.title ?? '';
      _contentController.text = widget.entry!.content;
      _songUrlController.text = widget.entry!.songUrl ?? '';
      _songTitleController.text = widget.entry!.songTitle ?? '';
      _songArtistController.text = widget.entry!.songArtist ?? '';
    }
  }

  Future<void> _saveEntry() async {
    if (_contentController.text.trim().isEmpty) return;

    setState(() => _isSaving = true);
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      if (user == null) throw Exception('No hay sesión activa');

      // Get public user id
      final userData = await Supabase.instance.client
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();

      String? finalSongUrl = _songUrlController.text.trim();
      if (finalSongUrl.isNotEmpty) {
        String? videoId = YoutubePlayer.convertUrlToId(finalSongUrl);
        if (videoId == null) {
          throw Exception('Enlace de YouTube no válido');
        }
      }

      final entry = DiaryEntryModel(
        id: widget.entry?.id ?? 0,
        userId: userData['id'] as int,
        title: _titleController.text.trim().isEmpty ? null : _titleController.text.trim(),
        content: _contentController.text.trim(),
        entryDate: widget.entry?.entryDate ?? DateTime.now(),
        songTitle: _songTitleController.text.trim().isEmpty ? null : _songTitleController.text.trim(),
        songArtist: _songArtistController.text.trim().isEmpty ? null : _songArtistController.text.trim(),
        songUrl: finalSongUrl.isEmpty ? null : finalSongUrl,
        createdAt: widget.entry?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      );

      if (widget.entry == null) {
        await ref.read(diaryRepositoryProvider).createEntry(entry);
      } else {
        await ref.read(diaryRepositoryProvider).updateEntry(entry);
      }
      
      ref.invalidate(diaryEntriesProvider);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al guardar: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.entry != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Editar Entrada' : 'Nueva Entrada'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveEntry,
            child: _isSaving 
              ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('GUARDAR', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: PaperCard(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _titleController,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontFamily: 'Fraunces'),
                decoration: const InputDecoration(
                  hintText: 'Título (opcional)',
                  border: InputBorder.none,
                ),
              ),
              const Divider(),
              TextField(
                controller: _contentController,
                maxLines: null,
                minLines: 10,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.6),
                decoration: const InputDecoration(
                  hintText: 'Escribe tus pensamientos aquí...',
                  border: InputBorder.none,
                ),
              ),
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.music_note, color: AppTheme.olive),
                  const SizedBox(width: 8),
                  Text('Añadir una canción', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppTheme.oliveDeep)),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _songTitleController,
                decoration: const InputDecoration(
                  hintText: 'Título de la canción',
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _songArtistController,
                decoration: const InputDecoration(
                  hintText: 'Artista',
                  isDense: true,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _songUrlController,
                decoration: const InputDecoration(
                  hintText: 'Enlace de YouTube (Ej: https://youtu.be/...)',
                  isDense: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
