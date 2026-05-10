class EntryPhotoModel {
  final int id;
  final int entryId;
  final String photoUrl;
  final DateTime createdAt;

  EntryPhotoModel({
    required this.id,
    required this.entryId,
    required this.photoUrl,
    required this.createdAt,
  });

  factory EntryPhotoModel.fromJson(Map<String, dynamic> json) {
    return EntryPhotoModel(
      id: json['id'] as int,
      entryId: json['entry_id'] as int,
      photoUrl: json['photo_url'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'entry_id': entryId,
      'photo_url': photoUrl,
      'created_at': createdAt.toIso8601String(),
    };
  }
}
