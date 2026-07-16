import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/streaks/data/models/streak_summary_model.dart';
import 'package:telefono/features/streaks/data/repositories/streaks_repository.dart';

class StreaksScreen extends ConsumerWidget {
  const StreaksScreen({super.key});

  String _formatWeekDate(DateTime? date) {
    if (date == null) return '';
    return DateFormat('dd MMM, yyyy').format(date);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final streakAsync = ref.watch(streakProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tu racha')),
      body: RefreshIndicator(
        color: AppTheme.olive,
        onRefresh: () async => ref.invalidate(streakProvider),
        child: streakAsync.when(
          skipLoadingOnReload: true,
          skipLoadingOnRefresh: true,
          data: (streak) => _buildContent(context, streak, loading: false),
          loading: () => _buildContent(context, StreakSummary.empty(), loading: true),
          error: (err, _) => _buildError(context, ref),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, StreakSummary streak, {required bool loading}) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        _buildFlameCard(context, streak, loading: loading),
        const SizedBox(height: 24),
        _buildCurrentWeek(context, streak),
        const SizedBox(height: 24),
        _buildTotalCompleted(context, streak),
        const SizedBox(height: 16),
        _buildHistory(context, streak),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildFlameCard(BuildContext context, StreakSummary streak, {required bool loading}) {
    final subtitle = loading
        ? 'cargando racha...'
        : streak.completed
            ? 'semana completada'
            : 'días escritos esta semana';

    return PaperCard(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 24),
      child: Column(
        children: [
          Container(
            height: 96,
            width: 96,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppTheme.olive, AppTheme.oliveDeep],
              ),
              boxShadow: [
                BoxShadow(
                  color: Color(0x33363C29),
                  blurRadius: 24,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: const Icon(Icons.local_fire_department, size: 48, color: AppTheme.cream),
          ),
          const SizedBox(height: 20),
          Text(
            '${streak.daysWritten}/7',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontFamily: 'Fraunces',
                  color: AppTheme.oliveDeep,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.olive),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentWeek(BuildContext context, StreakSummary streak) {
    return PaperCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('SEMANA ACTUAL'),
          const SizedBox(height: 16),
          Row(
            children: [
              for (final day in streak.days)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Column(
                      children: [
                        Text(
                          day.label.toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            letterSpacing: 0.5,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.olive.withOpacity(0.7),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: day.written ? AppTheme.olive : AppTheme.cream.withOpacity(0.6),
                            borderRadius: BorderRadius.circular(12),
                            border: day.written
                                ? null
                                : Border.all(color: AppTheme.border, width: 0.5),
                          ),
                          child: day.written
                              ? const Icon(Icons.check, size: 16, color: Colors.white)
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCompleted(BuildContext context, StreakSummary streak) {
    final total = streak.totalCompletedWeeks;
    return PaperCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('RACHAS COMPLETAS'),
          const SizedBox(height: 12),
          Text(
            '$total',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontFamily: 'Fraunces',
                  color: AppTheme.oliveDeep,
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            total == 1 ? 'semana perfecta acumulada' : 'semanas perfectas acumuladas',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.olive),
          ),
        ],
      ),
    );
  }

  Widget _buildHistory(BuildContext context, StreakSummary streak) {
    final history = streak.completedWeeksHistory;
    return PaperCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionTitle('HISTORIAL DE RACHAS'),
          const SizedBox(height: 16),
          if (history.isEmpty)
            Text(
              'Aún no has completado una semana perfecta.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.olive),
            )
          else
            ...history.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppTheme.cream.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.border.withOpacity(0.6)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${_formatWeekDate(item.weekStartDate)} - ${_formatWeekDate(item.weekEndDate)}',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: AppTheme.oliveDeep,
                                  ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${item.daysWritten}/7 días escritos',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.olive.withOpacity(0.8),
                                  ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppTheme.olive,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Text(
                          'Completa',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        letterSpacing: 1.5,
        color: AppTheme.olive.withOpacity(0.7),
      ),
    );
  }

  Widget _buildError(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        const Center(child: Text('No se pudo cargar tu racha semanal.')),
        const SizedBox(height: 12),
        Center(
          child: TextButton(
            onPressed: () => ref.invalidate(streakProvider),
            child: const Text('Reintentar'),
          ),
        ),
      ],
    );
  }
}
