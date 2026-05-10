class DiaryEntryModel {
  final int id;
  final int userId;
  final String? title;
  final String content;
  final DateTime entryDate;
  final String? songTitle;
  final String? songArtist;
  final String? songUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  DiaryEntryModel({
    required this.id,
    required this.userId,
    this.title,
    required this.content,
    required this.entryDate,
    this.songTitle,
    this.songArtist,
    this.songUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DiaryEntryModel.fromJson(Map<String, dynamic> json) {
    return DiaryEntryModel(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      title: json['title'] as String?,
      content: json['content'] as String,
      entryDate: DateTime.parse(json['entry_date'] as String),
      songTitle: json['song_title'] as String?,
      songArtist: json['song_artist'] as String?,
      songUrl: json['song_url'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Map<String, dynamic> toJson({bool isInsert = false}) {
    final data = {
      'user_id': userId,
      'title': title,
      'content': content,
      'entry_date': entryDate.toIso8601String().split('T').first,
      'song_title': songTitle,
      'song_artist': songArtist,
      'song_url': songUrl,
    };

    if (!isInsert) {
      data['id'] = id;
      data['created_at'] = createdAt.toIso8601String();
      data['updated_at'] = updatedAt.toIso8601String();
    }

    return data;
  }
}
