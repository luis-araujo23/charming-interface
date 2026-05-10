class WeeklyStreakModel {
  final int id;
  final int userId;
  final DateTime weekStartDate;
  final DateTime weekEndDate;
  final int daysWritten;
  final bool completed;
  final DateTime createdAt;
  final DateTime updatedAt;

  WeeklyStreakModel({
    required this.id,
    required this.userId,
    required this.weekStartDate,
    required this.weekEndDate,
    required this.daysWritten,
    required this.completed,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WeeklyStreakModel.fromJson(Map<String, dynamic> json) {
    return WeeklyStreakModel(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      weekStartDate: DateTime.parse(json['week_start_date'] as String),
      weekEndDate: DateTime.parse(json['week_end_date'] as String),
      daysWritten: json['days_written'] as int,
      completed: json['completed'] as bool,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'week_start_date': weekStartDate.toIso8601String().split('T').first,
      'week_end_date': weekEndDate.toIso8601String().split('T').first,
      'days_written': daysWritten,
      'completed': completed,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }
}
