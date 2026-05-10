import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:table_calendar/table_calendar.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;

  @override
  Widget build(BuildContext context) {
    final entriesAsync = ref.watch(diaryEntriesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Calendario')),
      body: entriesAsync.when(
        data: (entries) {
          final entriesMap = <DateTime, List>{};
          for (var entry in entries) {
            final date = DateTime(entry.entryDate.year, entry.entryDate.month, entry.entryDate.day);
            entriesMap[date] = (entriesMap[date] ?? [])..add(entry);
          }

          return Column(
            children: [
              TableCalendar(
                firstDay: DateTime.utc(2020, 1, 1),
                lastDay: DateTime.utc(2030, 12, 31),
                focusedDay: _focusedDay,
                selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
                onDaySelected: (selectedDay, focusedDay) {
                  setState(() {
                    _selectedDay = selectedDay;
                    _focusedDay = focusedDay;
                  });
                },
                calendarStyle: CalendarStyle(
                  todayDecoration: BoxDecoration(
                    color: AppTheme.olive.withOpacity(0.3),
                    shape: BoxShape.circle,
                  ),
                  selectedDecoration: const BoxDecoration(
                    color: AppTheme.olive,
                    shape: BoxShape.circle,
                  ),
                  markerDecoration: const BoxDecoration(
                    color: AppTheme.mint,
                    shape: BoxShape.circle,
                  ),
                ),
                eventLoader: (day) {
                  final date = DateTime(day.year, day.month, day.day);
                  return entriesMap[date] ?? [];
                },
                headerStyle: const HeaderStyle(
                  formatButtonVisible: false,
                  titleCentered: true,
                ),
              ),
              const Divider(),
              if (_selectedDay != null)
                Expanded(
                  child: _buildDayEntries(entriesMap[DateTime(_selectedDay!.year, _selectedDay!.month, _selectedDay!.day)] ?? []),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppTheme.olive)),
        error: (err, stack) => Center(child: Text('Error: $err')),
      ),
    );
  }

  Widget _buildDayEntries(List entries) {
    if (entries.isEmpty) {
      return const Center(child: Text('No hay entradas para este día'));
    }
    return ListView.builder(
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final entry = entries[index];
        return ListTile(
          title: Text(entry.title ?? 'Sin título', style: const TextStyle(fontFamily: 'Fraunces')),
          subtitle: Text(entry.content, maxLines: 1, overflow: TextOverflow.ellipsis),
          onTap: () {
            // Ir a detalle
          },
        );
      },
    );
  }
}
