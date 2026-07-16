class MemoryModel {
  final int id;
  final int entryId;
  final String entryTitle;
  final DateTime? entryDate;
  final DateTime? memoryDate;
  final String selectedText;
  final DateTime? createdAt;

  MemoryModel({
    required this.id,
    required this.entryId,
    required this.entryTitle,
    this.entryDate,
    this.memoryDate,
    required this.selectedText,
    this.createdAt,
  });

  factory MemoryModel.fromMap(Map<String, dynamic> map) {
    DateTime? parseDate(dynamic value) {
      if (value is String && value.isNotEmpty) {
        return DateTime.tryParse(value);
      }
      return null;
    }

    final title = (map['entryTitle'] ?? map['entry_title'])?.toString().trim();

    return MemoryModel(
      id: map['id'] as int,
      entryId: (map['entryId'] ?? map['entry_id']) as int,
      entryTitle: (title == null || title.isEmpty) ? 'Entrada sin título' : title,
      entryDate: parseDate(map['entryDate'] ?? map['entry_date']),
      memoryDate: parseDate(map['memoryDate'] ?? map['memory_date']),
      selectedText: (map['selectedText'] ?? map['selected_text'] ?? '').toString(),
      createdAt: parseDate(map['createdAt'] ?? map['created_at']),
    );
  }
}
