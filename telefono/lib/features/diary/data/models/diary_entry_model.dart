class EntryComment {
  final int? id;
  final String authorUsername;
  final String message;
  final DateTime? createdAt;
  final String? taggedUserUsername;

  EntryComment({
    this.id,
    required this.authorUsername,
    required this.message,
    this.createdAt,
    this.taggedUserUsername,
  });

  factory EntryComment.fromMap(Map<String, dynamic> map) {
    DateTime? parsedDate;
    final rawDate = map['createdAt'] ?? map['created_at'];
    if (rawDate is String && rawDate.isNotEmpty) {
      parsedDate = DateTime.tryParse(rawDate);
    }

    return EntryComment(
      id: map['id'] is int ? map['id'] as int : (map['comment_id'] as int?),
      authorUsername:
          (map['authorUsername'] ?? map['author_username'] ?? '').toString(),
      message: (map['message'] ?? '').toString(),
      createdAt: parsedDate,
      taggedUserUsername:
          (map['taggedUserUsername'] ?? map['tagged_user_username'])?.toString(),
    );
  }
}

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
  final List<String> photoUrls;
  final List<String> taggedUsers;
  final List<EntryComment> comments;

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
    this.photoUrls = const [],
    this.taggedUsers = const [],
    this.comments = const [],
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

  DiaryEntryModel copyWith({
    List<String>? photoUrls,
    List<String>? taggedUsers,
    List<EntryComment>? comments,
  }) {
    return DiaryEntryModel(
      id: id,
      userId: userId,
      title: title,
      content: content,
      entryDate: entryDate,
      songTitle: songTitle,
      songArtist: songArtist,
      songUrl: songUrl,
      createdAt: createdAt,
      updatedAt: updatedAt,
      photoUrls: photoUrls ?? this.photoUrls,
      taggedUsers: taggedUsers ?? this.taggedUsers,
      comments: comments ?? this.comments,
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
