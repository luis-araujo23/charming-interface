class RememberedEntryModel {
  final int id;
  final int userId;
  final int entryId;
  final DateTime memoryDate;
  final String? selectedText;
  final DateTime createdAt;

  RememberedEntryModel({
    required this.id,
    required this.userId,
    required this.entryId,
    required this.memoryDate,
    this.selectedText,
    required this.createdAt,
  });

  factory RememberedEntryModel.fromJson(Map<String, dynamic> json) {
    return RememberedEntryModel(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      entryId: json['entry_id'] as int,
      memoryDate: DateTime.parse(json['memory_date'] as String),
      selectedText: json['selected_text'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'entry_id': entryId,
      'memory_date': memoryDate.toIso8601String().split('T').first,
      'selected_text': selectedText,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
