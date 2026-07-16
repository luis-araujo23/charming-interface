import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/friends/data/friends_providers.dart';
import 'package:telefono/features/streaks/data/repositories/streaks_repository.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

class AddEntryScreen extends ConsumerStatefulWidget {
  const AddEntryScreen({super.key});

  @override
  ConsumerState<AddEntryScreen> createState() => _AddEntryScreenState();
}

class _AddEntryScreenState extends ConsumerState<AddEntryScreen> {
  static const int _titleMaxLength = 25;
  static const int _maxPhotos = 8;
  static const int _maxTags = 10;
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();
  final _songUrlController = TextEditingController();
  final _songTitleController = TextEditingController();
  final _songArtistController = TextEditingController();
  final _picker = ImagePicker();
  final List<_PickedImage> _images = [];
  final Set<String> _selectedFriendUsernames = <String>{};
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    _songUrlController.dispose();
    _songTitleController.dispose();
    _songArtistController.dispose();
    super.dispose();
  }

  String _contentTypeFor(String name) {
    final ext = name.contains('.') ? name.split('.').last.toLowerCase() : '';
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'jpg':
      case 'jpeg':
      default:
        return 'image/jpeg';
    }
  }

  Future<void> _pickImages() async {
    try {
      final picked = await _picker.pickMultiImage(imageQuality: 85);
      if (picked.isEmpty) return;

      var reachedLimit = false;
      for (final file in picked) {
        if (_images.length >= _maxPhotos) {
          reachedLimit = true;
          break;
        }
        final bytes = await file.readAsBytes();
        _images.add(_PickedImage(bytes: bytes, name: file.name));
      }

      if (mounted) {
        setState(() {});
        if (reachedLimit) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Puedes adjuntar hasta $_maxPhotos imágenes por entrada.'),
              backgroundColor: AppTheme.olive,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('No se pudieron seleccionar las imágenes: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  Future<void> _openFriendSelector() async {
    final friends = await ref.read(acceptedFriendsProvider.future);

    if (!mounted) return;

    if (friends.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Aún no tienes amigos aceptados para etiquetar.'),
          backgroundColor: AppTheme.olive,
        ),
      );
      return;
    }

    final tempSelection = Set<String>.from(_selectedFriendUsernames);

    final result = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.cream,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Text(
                        'Etiquetar amigos',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: AppTheme.oliveDeep,
                              fontWeight: FontWeight.bold,
                            ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Flexible(
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: friends.length,
                        itemBuilder: (context, index) {
                          final friend = friends[index];
                          final username = friend['username'] as String;
                          final selected = tempSelection.contains(username);
                          return CheckboxListTile(
                            value: selected,
                            activeColor: AppTheme.olive,
                            title: Text(username),
                            secondary: CircleAvatar(
                              backgroundColor: AppTheme.mint,
                              child: Text(
                                username.isNotEmpty ? username[0].toUpperCase() : '?',
                                style: const TextStyle(color: Colors.white),
                              ),
                            ),
                            onChanged: (checked) {
                              setSheetState(() {
                                if (checked == true) {
                                  if (tempSelection.length >= _maxTags) return;
                                  tempSelection.add(username);
                                } else {
                                  tempSelection.remove(username);
                                }
                              });
                            },
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(backgroundColor: AppTheme.olive),
                          onPressed: () => Navigator.of(context).pop(tempSelection),
                          child: const Text('Listo'),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (result != null && mounted) {
      setState(() {
        _selectedFriendUsernames
          ..clear()
          ..addAll(result);
      });
    }
  }

  Future<void> _saveEntry() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();

    if (content.isEmpty) return;

    if (title.length > _titleMaxLength) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('El titulo no puede superar 25 caracteres.'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
      return;
    }

    setState(() => _isSaving = true);
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      if (user == null) throw Exception('No hay sesión activa');

      // Get public user id
      final userData = await Supabase.instance.client
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle();

      if (userData == null) {
        throw Exception('No encontramos tu perfil. Cierra sesion y vuelve a iniciarla.');
      }

      String? finalSongUrl = _songUrlController.text.trim();
      if (finalSongUrl.isNotEmpty) {
        String? videoId = YoutubePlayer.convertUrlToId(finalSongUrl);
        if (videoId == null) {
          throw Exception('Enlace de YouTube no válido');
        }
      }

      final publicUserId = userData['id'] as int;
      final entry = DiaryEntryModel(
        id: 0,
        userId: publicUserId,
        title: title.isEmpty ? null : title,
        content: content,
        entryDate: DateTime.now(),
        songTitle: _songTitleController.text.trim().isEmpty ? null : _songTitleController.text.trim(),
        songArtist: _songArtistController.text.trim().isEmpty ? null : _songArtistController.text.trim(),
        songUrl: finalSongUrl.isEmpty ? null : finalSongUrl,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      final repository = ref.read(diaryRepositoryProvider);
      final entryId = await repository.createEntry(entry);

      // La entrada ya está guardada; las etiquetas y fotos son complementos.
      // Si fallan, avisamos pero no perdemos la entrada.
      String? extrasWarning;
      try {
        if (_selectedFriendUsernames.isNotEmpty) {
          await repository.attachTags(entryId, _selectedFriendUsernames.toList());
        }
        for (final image in _images) {
          await repository.uploadAndAttachPhoto(
            userId: publicUserId,
            entryId: entryId,
            bytes: image.bytes,
            fileName: image.name,
            contentType: _contentTypeFor(image.name),
          );
        }
      } catch (extrasError) {
        extrasWarning =
            'Se guardó la entrada, pero hubo un problema al adjuntar fotos o etiquetas: $extrasError';
      }

      ref.invalidate(diaryEntriesProvider);
      // Una entrada nueva puede cambiar la racha semanal.
      ref.invalidate(streakProvider);
      if (mounted) {
        if (extrasWarning != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(extrasWarning), backgroundColor: AppTheme.error),
          );
        }
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        final errorText = e.toString();
        final isValueTooLong = e is PostgrestException && e.code == '22001';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isValueTooLong
                  ? 'Uno de los campos supera el limite permitido (titulo maximo: 25 caracteres).'
                  : 'Error al guardar: $errorText',
            ),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nueva Entrada'),
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
                maxLength: _titleMaxLength,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontFamily: 'Fraunces'),
                decoration: const InputDecoration(
                  hintText: 'Titulo (opcional, max 25)',
                  border: InputBorder.none,
                  counterText: '',
                ),
              ),
              const Divider(),
              TextField(
                controller: _contentController,
                maxLines: null,
                minLines: 10,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.6),
                decoration: const InputDecoration(
                  hintText: 'querida kitty...',
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
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 8),
              _buildTagFriendsSection(context),
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 8),
              _buildPhotosSection(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTagFriendsSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.people_alt, color: AppTheme.olive),
            const SizedBox(width: 8),
            Text(
              'Etiquetar amigos',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppTheme.oliveDeep),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _openFriendSelector,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Agregar'),
            ),
          ],
        ),
        if (_selectedFriendUsernames.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Etiqueta amigos de tu lista para compartir esta entrada.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              children: _selectedFriendUsernames.map((username) {
                return Chip(
                  label: Text('@$username'),
                  backgroundColor: AppTheme.mint.withOpacity(0.2),
                  onDeleted: () {
                    setState(() => _selectedFriendUsernames.remove(username));
                  },
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  Widget _buildPhotosSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.photo_library, color: AppTheme.olive),
            const SizedBox(width: 8),
            Text(
              'Fotos',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(color: AppTheme.oliveDeep),
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _images.length >= _maxPhotos ? null : _pickImages,
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
              label: const Text('Agregar'),
            ),
          ],
        ),
        if (_images.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Adjunta imágenes para acompañar tu entrada (máx $_maxPhotos).',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (int i = 0; i < _images.length; i++)
                  Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(
                          _images[i].bytes,
                          width: 88,
                          height: 88,
                          fit: BoxFit.cover,
                        ),
                      ),
                      Positioned(
                        top: -6,
                        right: -6,
                        child: IconButton(
                          icon: const Icon(Icons.cancel, color: AppTheme.error),
                          iconSize: 22,
                          onPressed: () => setState(() => _images.removeAt(i)),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _PickedImage {
  final Uint8List bytes;
  final String name;

  _PickedImage({required this.bytes, required this.name});
}
