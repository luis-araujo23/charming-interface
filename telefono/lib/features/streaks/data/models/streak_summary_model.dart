/// Un dia de la semana actual dentro de la racha.
class StreakDay {
  final String label;
  final DateTime? date;
  final bool written;

  StreakDay({required this.label, this.date, required this.written});

  factory StreakDay.fromMap(Map<String, dynamic> map) {
    final rawDate = map['date']?.toString();
    return StreakDay(
      label: (map['label'] ?? '').toString(),
      date: (rawDate != null && rawDate.isNotEmpty) ? DateTime.tryParse(rawDate) : null,
      written: map['written'] == true,
    );
  }
}

/// Una semana perfecta (7/7) del historial.
class CompletedWeek {
  final DateTime? weekStartDate;
  final DateTime? weekEndDate;
  final int daysWritten;
  final bool completed;

  CompletedWeek({
    this.weekStartDate,
    this.weekEndDate,
    required this.daysWritten,
    required this.completed,
  });

  factory CompletedWeek.fromMap(Map<String, dynamic> map) {
    DateTime? parse(dynamic value) {
      final s = value?.toString();
      if (s == null || s.isEmpty) return null;
      return DateTime.tryParse(s);
    }

    return CompletedWeek(
      weekStartDate: parse(map['weekStartDate']),
      weekEndDate: parse(map['weekEndDate']),
      daysWritten: (map['daysWritten'] as num?)?.toInt() ?? 0,
      completed: map['completed'] == true,
    );
  }
}

/// Resumen completo de la racha semanal, equivalente a la respuesta de
/// /api/streaks de la web.
class StreakSummary {
  final DateTime? weekStartDate;
  final DateTime? weekEndDate;
  final int daysWritten;
  final bool completed;
  final List<StreakDay> days;
  final int totalCompletedWeeks;
  final List<CompletedWeek> completedWeeksHistory;

  StreakSummary({
    this.weekStartDate,
    this.weekEndDate,
    required this.daysWritten,
    required this.completed,
    required this.days,
    required this.totalCompletedWeeks,
    required this.completedWeeksHistory,
  });

  /// Etiquetas por defecto (Lunes a Domingo) para rellenar si faltaran dias.
  static const List<String> defaultLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  factory StreakSummary.empty() => StreakSummary(
        daysWritten: 0,
        completed: false,
        days: List.generate(
          7,
          (i) => StreakDay(label: defaultLabels[i], written: false),
        ),
        totalCompletedWeeks: 0,
        completedWeeksHistory: const [],
      );

  factory StreakSummary.fromMap(Map<String, dynamic> map) {
    DateTime? parse(dynamic value) {
      final s = value?.toString();
      if (s == null || s.isEmpty) return null;
      return DateTime.tryParse(s);
    }

    final rawDays = (map['days'] as List?) ?? const [];
    var days = rawDays
        .map((e) => StreakDay.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();

    // Garantiza siempre 7 celdas para que la cuadricula de la UI sea estable.
    if (days.length < 7) {
      for (var i = days.length; i < 7; i++) {
        days.add(StreakDay(label: defaultLabels[i], written: false));
      }
    } else if (days.length > 7) {
      days = days.sublist(0, 7);
    }

    final history = ((map['completedWeeksHistory'] as List?) ?? const [])
        .map((e) => CompletedWeek.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList();

    return StreakSummary(
      weekStartDate: parse(map['weekStartDate']),
      weekEndDate: parse(map['weekEndDate']),
      daysWritten: (map['daysWritten'] as num?)?.toInt() ?? 0,
      completed: map['completed'] == true,
      days: days,
      totalCompletedWeeks: (map['totalCompletedWeeks'] as num?)?.toInt() ?? 0,
      completedWeeksHistory: history,
    );
  }
}
