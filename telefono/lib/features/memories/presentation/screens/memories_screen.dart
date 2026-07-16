import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/memories/data/models/memory_model.dart';
import 'package:telefono/features/memories/data/repositories/memories_repository.dart';

class MemoriesScreen extends ConsumerWidget {
  const MemoriesScreen({super.key});

  String _formatDate(DateTime? date) {
    if (date == null) return 'Fecha desconocida';
    return DateFormat('dd MMM, yyyy').format(date);
  }

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    MemoryModel memory,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Eliminar recuerdo'),
        content: const Text('¿Seguro que quieres eliminar este recuerdo? Esta acción no se puede deshacer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppTheme.error),
            child: const Text('Eliminar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ref.read(memoriesRepositoryProvider).deleteMemory(memory.id);
      ref.invalidate(memoriesProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Recuerdo eliminado.'), backgroundColor: AppTheme.olive),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo eliminar: $e'), backgroundColor: AppTheme.error),
        );
      }
    }
  }

  void _openMemory(BuildContext context, MemoryModel memory) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.5,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        builder: (context, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(24),
          child: Column(
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
              const SizedBox(height: 20),
              Text(
                _formatDate(memory.entryDate),
                style: const TextStyle(color: AppTheme.olive, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              Text(
                memory.entryTitle,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontFamily: 'Fraunces',
                      color: AppTheme.oliveDeep,
                    ),
              ),
              const SizedBox(height: 16),
              Text(
                memory.selectedText,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.6),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memoriesAsync = ref.watch(memoriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Recuerdos')),
      body: RefreshIndicator(
        color: AppTheme.olive,
        onRefresh: () async => ref.invalidate(memoriesProvider),
        child: memoriesAsync.when(
          // Al invalidar tras guardar/borrar, conservamos la lista visible en
          // lugar de destruirla y volver a un spinner. Reconstruir el ListView
          // completo en cada cambio provocaba reconciliaciones fragiles.
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          data: (memories) {
            if (memories.isEmpty) return _buildEmptyState(context);

            // Todos los items comparten EXACTAMENTE la misma forma de arbol
            // (Padding > Dismissible[key estable] > tarjeta). Solo cambia el
            // contenido de la tarjeta (destacada vs. normal). Asi, al reordenar
            // la lista, Flutter mueve los elementos por su clave sin cambiar su
            // estructura, evitando el error '_dependents.isEmpty'.
            return ListView.builder(
              padding: const EdgeInsets.all(20),
              itemCount: memories.length,
              itemBuilder: (context, index) {
                final memory = memories[index];
                return Padding(
                  key: ValueKey('memory-${memory.id}'),
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Dismissible(
                    key: ValueKey('memory-dismiss-${memory.id}'),
                    direction: DismissDirection.endToStart,
                    confirmDismiss: (_) async {
                      await _confirmDelete(context, ref, memory);
                      return false;
                    },
                    background: _dismissBackground(),
                    child: GestureDetector(
                      onTap: () => _openMemory(context, memory),
                      child: index == 0
                          ? _featuredCard(
                              context,
                              memory,
                              () => _confirmDelete(context, ref, memory),
                            )
                          : _tileCard(
                              context,
                              memory,
                              () => _confirmDelete(context, ref, memory),
                            ),
                    ),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.olive)),
          error: (err, _) => _buildErrorState(context, ref),
        ),
      ),
    );
  }

  Widget _featuredCard(BuildContext context, MemoryModel memory, VoidCallback onDelete) {
    return PaperCard(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.mint.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.auto_awesome, size: 12, color: AppTheme.oliveDeep),
                    const SizedBox(width: 4),
                    Text(
                      'RECUERDO DESTACADO',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1,
                        color: AppTheme.oliveDeep,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              _deleteButton(onDelete),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _formatDate(memory.entryDate),
            style: const TextStyle(color: AppTheme.olive, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            memory.entryTitle,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontFamily: 'Fraunces',
                  color: AppTheme.oliveDeep,
                ),
          ),
          const SizedBox(height: 12),
          Text(
            memory.selectedText,
            maxLines: 6,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _tileCard(BuildContext context, MemoryModel memory, VoidCallback onDelete) {
    return PaperCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _formatDate(memory.entryDate),
                  style: TextStyle(
                    fontSize: 11,
                    letterSpacing: 0.5,
                    color: AppTheme.olive.withOpacity(0.8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                'Entrada #${memory.entryId}',
                style: TextStyle(fontSize: 11, color: AppTheme.olive.withOpacity(0.6)),
              ),
              const SizedBox(width: 4),
              _deleteButton(onDelete),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            memory.entryTitle,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: AppTheme.oliveDeep,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            memory.selectedText,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _deleteButton(VoidCallback onDelete) {
    return IconButton(
      onPressed: onDelete,
      visualDensity: VisualDensity.compact,
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
      tooltip: 'Eliminar recuerdo',
      icon: const Icon(Icons.delete_outline, size: 20, color: AppTheme.error),
    );
  }

  Widget _dismissBackground() {
    return Container(
      alignment: Alignment.centerRight,
      padding: const EdgeInsets.only(right: 24),
      decoration: BoxDecoration(
        color: AppTheme.error.withOpacity(0.85),
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Icon(Icons.delete_outline, color: Colors.white),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.2),
        Icon(Icons.auto_awesome_outlined, size: 64, color: AppTheme.olive.withOpacity(0.3)),
        const SizedBox(height: 16),
        const Center(
          child: Text(
            'Aún no tienes recuerdos guardados',
            style: TextStyle(color: AppTheme.olive, fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 8),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Ve al diario, abre una entrada y usa el botón de estrella para guardar un fragmento aquí.',
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        const Center(child: Text('No se pudieron cargar tus recuerdos.')),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: () => ref.invalidate(memoriesProvider),
            child: const Text('Reintentar'),
          ),
        ),
      ],
    );
  }
}
