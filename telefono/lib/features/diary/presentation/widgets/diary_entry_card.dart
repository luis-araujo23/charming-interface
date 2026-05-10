import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/diary/data/models/diary_entry_model.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
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

  Future<void> _deleteEntry() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('¿Eliminar entrada?'),
        content: const Text('Esta acción no se puede deshacer.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCELAR')),
          TextButton(
            onPressed: () => Navigator.pop(context, true), 
            child: const Text('ELIMINAR', style: TextStyle(color: Colors.red))
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(diaryRepositoryProvider).deleteEntry(widget.entry.id);
      ref.invalidate(diaryEntriesProvider);
    }
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
              children: [
                Text(
                  DateFormat('dd MMMM, yyyy').format(widget.entry.entryDate),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppTheme.olive,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18, color: AppTheme.olive),
                      onPressed: () => context.push('/add-entry', extra: widget.entry),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                      onPressed: _deleteEntry,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
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
          ],
        ),
      ),
    );
  }
}
