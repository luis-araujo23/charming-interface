import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/memories/data/repositories/memories_repository.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

class DiaryEntryCard extends ConsumerStatefulWidget {
  final DiaryEntryModel entry;

  const DiaryEntryCard({super.key, required this.entry});

  @override
  ConsumerState<DiaryEntryCard> createState() => _DiaryEntryCardState();
}

class _DiaryEntryCardState extends ConsumerState<DiaryEntryCard> {
  YoutubePlayerController? _youtubeController;
  bool _isPlaying = false;
  String? _videoId;

  @override
  void initState() {
    super.initState();
    if (widget.entry.songUrl != null && widget.entry.songUrl!.isNotEmpty) {
      _videoId = YoutubePlayer.convertUrlToId(widget.entry.songUrl!);
    }
  }

  @override
  void dispose() {
    _youtubeController?.dispose();
    super.dispose();
  }

  void _playVideo() {
    if (_videoId == null) return;
    
    setState(() {
      _isPlaying = true;
      _youtubeController = YoutubePlayerController(
        initialVideoId: _videoId!,
        flags: const YoutubePlayerFlags(
          autoPlay: true,
          mute: false,
          enableCaption: false,
        ),
      );
    });
  }

  /// Abre una hoja inferior para guardar un fragmento de esta entrada como
  /// "recuerdo". El texto viene precargado con el contenido de la entrada para
  /// que el usuario recorte lo que quiera conservar (equivalente a seleccionar
  /// texto en la web). Valida no vacio y maximo 2000 caracteres.
  Future<void> _saveMemory() async {
    // La hoja es un StatefulWidget dedicado que POSEE su TextEditingController
    // y lo libera en su propio dispose(). Asi el controller vive exactamente lo
    // que vive la hoja y nunca se usa despues de liberarse (causa del crash
    // anterior). La invalidacion del provider se hace aqui, ya cerrada la hoja.
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => _SaveMemorySheet(entry: widget.entry),
    );

    if (saved == true && mounted) {
      ref.invalidate(memoriesProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Guardado en Recuerdos.'),
          backgroundColor: AppTheme.olive,
        ),
      );
    }
  }

  void _openPhotoViewer(BuildContext context, String url) {
    showDialog<void>(
      context: context,
      barrierColor: Colors.black87,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(url, fit: BoxFit.contain),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhotos(BuildContext context) {
    final photos = widget.entry.photoUrls;

    if (photos.length == 1) {
      return GestureDetector(
        onTap: () => _openPhotoViewer(context, photos.first),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            photos.first,
            width: double.infinity,
            height: 200,
            fit: BoxFit.cover,
            errorBuilder: (context, error, stack) => _photoError(),
          ),
        ),
      );
    }

    return SizedBox(
      height: 110,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final url = photos[index];
          return GestureDetector(
            onTap: () => _openPhotoViewer(context, url),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                url,
                width: 110,
                height: 110,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stack) => _photoError(),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _photoError() {
    return Container(
      width: 110,
      height: 110,
      color: AppTheme.cream,
      child: const Icon(Icons.broken_image_outlined, color: AppTheme.olive),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: PaperCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    DateFormat('dd MMMM, yyyy').format(widget.entry.entryDate),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppTheme.olive,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _saveMemory,
                  visualDensity: VisualDensity.compact,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  tooltip: 'Guardar recuerdo',
                  icon: const Icon(Icons.auto_awesome_outlined, size: 20, color: AppTheme.olive),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (widget.entry.title != null)
              Text(
                widget.entry.title!,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontFamily: 'Fraunces',
                  color: AppTheme.oliveDeep,
                ),
              ),
            const SizedBox(height: 8),
            Text(
              widget.entry.content,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.5,
              ),
            ),

            if (widget.entry.photoUrls.isNotEmpty) ...[
              const SizedBox(height: 12),
              _buildPhotos(context),
            ],

            if (widget.entry.taggedUsers.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  const Icon(Icons.people_alt, size: 16, color: AppTheme.olive),
                  ...widget.entry.taggedUsers.map(
                    (username) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.mint.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '@$username',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppTheme.oliveDeep,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                  ),
                ],
              ),
            ],

            if (_videoId != null) ...[
              const SizedBox(height: 16),
              if (_isPlaying && _youtubeController != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: YoutubePlayer(
                    controller: _youtubeController!,
                    showVideoProgressIndicator: true,
                    progressColors: const ProgressBarColors(
                      playedColor: AppTheme.mint,
                      handleColor: AppTheme.olive,
                    ),
                  ),
                )
              else
                GestureDetector(
                  onTap: _playVideo,
                  child: Container(
                    height: 180,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      image: DecorationImage(
                        image: NetworkImage(YoutubePlayer.getThumbnail(videoId: _videoId!)),
                        fit: BoxFit.cover,
                      ),
                    ),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.6),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow, color: Colors.white, size: 40),
                      ),
                    ),
                  ),
                ),
                
              if (widget.entry.songTitle != null || widget.entry.songArtist != null) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.my_library_music, size: 16, color: AppTheme.olive),
                    const SizedBox(width: 4),
                    Text(
                      '${widget.entry.songTitle ?? 'Canción'} - ${widget.entry.songArtist ?? 'Desconocido'}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.oliveDeep,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ]
            ],

            if (widget.entry.comments.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildComments(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildComments(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.cream.withOpacity(0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.border, width: 0.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.mode_comment_outlined, size: 15, color: AppTheme.olive),
              const SizedBox(width: 6),
              Text(
                'Comentarios (${widget.entry.comments.length})',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppTheme.oliveDeep,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...widget.entry.comments.map(
            (comment) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '@${comment.authorUsername}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.oliveDeep,
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  Text(
                    comment.message,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Hoja inferior para guardar un fragmento de una entrada como "recuerdo".
///
/// Es un StatefulWidget propio (no un StatefulBuilder con controller externo)
/// para que el [TextEditingController] tenga un ciclo de vida limpio: se crea en
/// [initState] y se libera en [dispose]. Devuelve `true` al hacer pop cuando el
/// guardado fue exitoso, para que quien la abre invalide el provider de
/// recuerdos ya con la hoja cerrada.
class _SaveMemorySheet extends ConsumerStatefulWidget {
  final DiaryEntryModel entry;

  const _SaveMemorySheet({required this.entry});

  @override
  ConsumerState<_SaveMemorySheet> createState() => _SaveMemorySheetState();
}

class _SaveMemorySheetState extends ConsumerState<_SaveMemorySheet> {
  late final TextEditingController _controller;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.entry.content);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      _showError('Escribe o deja el fragmento que quieres recordar.');
      return;
    }
    if (text.length > 2000) {
      _showError('El fragmento es demasiado largo (máximo 2000 caracteres).');
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ref.read(memoriesRepositoryProvider).addMemory(widget.entry.id, text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSaving = false);
      _showError('No se pudo guardar el recuerdo: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppTheme.error),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.border,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(Icons.auto_awesome, size: 18, color: AppTheme.oliveDeep),
                const SizedBox(width: 8),
                Text(
                  'Guardar recuerdo',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontFamily: 'Fraunces',
                        color: AppTheme.oliveDeep,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Recorta el texto para conservar solo el fragmento que quieres recordar.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.olive,
                  ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
              maxLines: 6,
              maxLength: 2000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white.withOpacity(0.6),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppTheme.olive, width: 2),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSaving ? null : _submit,
                icon: _isSaving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.auto_awesome, size: 18),
                label: Text(_isSaving ? 'Guardando...' : 'Guardar en Recuerdos'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
