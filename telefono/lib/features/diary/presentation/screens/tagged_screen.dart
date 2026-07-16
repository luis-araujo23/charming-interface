import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/diary/presentation/widgets/diary_entry_card.dart';

class TaggedScreen extends ConsumerStatefulWidget {
  const TaggedScreen({super.key});

  @override
  ConsumerState<TaggedScreen> createState() => _TaggedScreenState();
}

class _TaggedScreenState extends ConsumerState<TaggedScreen> {
  bool _isLoading = true;
  String? _error;
  List<Map<String, dynamic>> _notes = [];
  final Map<int, TextEditingController> _controllers = {};
  final Set<int> _submitting = <int>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(int entryTagId) {
    return _controllers.putIfAbsent(entryTagId, () => TextEditingController());
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final notes = await ref.read(diaryRepositoryProvider).getTaggedNotes();
      if (!mounted) return;
      setState(() => _notes = notes);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'No se pudieron cargar tus notas etiquetadas.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submitComment(int entryTagId) async {
    final controller = _controllerFor(entryTagId);
    final message = controller.text.trim();
    if (message.isEmpty) return;

    setState(() => _submitting.add(entryTagId));
    try {
      await ref.read(diaryRepositoryProvider).addTaggedComment(entryTagId, message);
      controller.clear();
      await _load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Comentario enviado'), backgroundColor: AppTheme.olive),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo enviar el comentario: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting.remove(entryTagId));
    }
  }

  DiaryEntryModel _mapNote(Map<String, dynamic> note) {
    final photoUrls = (note['photoUrls'] as List?)
            ?.map((e) => e.toString())
            .where((e) => e.isNotEmpty)
            .toList() ??
        <String>[];

    final comments = (note['comments'] as List?)
            ?.map((e) => EntryComment.fromMap(Map<String, dynamic>.from(e as Map)))
            .toList() ??
        <EntryComment>[];

    final entryDateRaw = note['entryDate']?.toString();
    final entryDate = (entryDateRaw != null && entryDateRaw.isNotEmpty)
        ? (DateTime.tryParse(entryDateRaw) ?? DateTime.now())
        : DateTime.now();

    return DiaryEntryModel(
      id: (note['entryId'] as int?) ?? 0,
      userId: 0,
      title: note['title'] as String?,
      content: (note['content'] ?? '').toString(),
      entryDate: entryDate,
      songTitle: note['songTitle'] as String?,
      songArtist: note['songArtist'] as String?,
      songUrl: note['songUrl'] as String?,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
      photoUrls: photoUrls,
      comments: comments,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Etiquetado')),
      body: RefreshIndicator(
        onRefresh: _load,
        color: AppTheme.olive,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.olive));
    }

    if (_error != null) {
      return ListView(
        children: [
          const SizedBox(height: 120),
          Center(child: Text(_error!, style: const TextStyle(color: AppTheme.error))),
          const SizedBox(height: 12),
          Center(
            child: TextButton(onPressed: _load, child: const Text('Reintentar')),
          ),
        ],
      );
    }

    if (_notes.isEmpty) {
      return ListView(
        children: const [
          SizedBox(height: 120),
          Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Aún no tienes notas donde te hayan etiquetado.',
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _notes.length,
      itemBuilder: (context, index) {
        final note = _notes[index];
        final entryTagId = note['entryTagId'] as int?;
        final taggedBy = note['taggedByUsername']?.toString() ?? '';
        final model = _mapNote(note);
        final isSubmitting = entryTagId != null && _submitting.contains(entryTagId);

        return Column(
          key: ValueKey('tagged-note-${entryTagId ?? index}'),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 4),
              child: Row(
                children: [
                  const Icon(Icons.local_offer, size: 14, color: AppTheme.olive),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Etiquetado por @$taggedBy',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppTheme.oliveDeep,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                ],
              ),
            ),
            DiaryEntryCard(entry: model),
            if (entryTagId != null)
              Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _controllerFor(entryTagId),
                        minLines: 1,
                        maxLines: 4,
                        maxLength: 1200,
                        decoration: InputDecoration(
                          hintText: 'Escribe un comentario...',
                          isDense: true,
                          counterText: '',
                          filled: true,
                          fillColor: AppTheme.cream.withOpacity(0.6),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(color: AppTheme.border),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: isSubmitting ? null : () => _submitComment(entryTagId),
                      icon: isSubmitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send, color: AppTheme.olive),
                      tooltip: 'Comentar',
                    ),
                  ],
                ),
              ),
            const SizedBox(height: 20),
          ],
        );
      },
    );
  }
}
