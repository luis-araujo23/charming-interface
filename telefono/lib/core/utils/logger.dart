import 'dart:developer' as dev;
import 'package:flutter/foundation.dart';

class AppLogger {
  static void info(String message) {
    _log('INFO', message);
  }

  static void warn(String message) {
    _log('WARNING', message);
  }

  static void error(String message, [Object? error, StackTrace? stackTrace]) {
    _log('ERROR', message, error, stackTrace);
  }

  static void _log(String level, String message, [Object? error, StackTrace? stackTrace]) {
    final timestamp = DateTime.now().toIso8601String();
    final logMessage = '[$level] [$timestamp] $message';
    
    if (kDebugMode) {
      // Print to terminal for easy copying
      print('----------------------------------------');
      print(logMessage);
      if (error != null) print('Exception: $error');
      if (stackTrace != null) print('StackTrace:\n$stackTrace');
      print('----------------------------------------');
    }
    
    // Also send to developer log
    dev.log(
      message,
      name: level,
      time: DateTime.now(),
      error: error,
      stackTrace: stackTrace,
    );
  }
}
