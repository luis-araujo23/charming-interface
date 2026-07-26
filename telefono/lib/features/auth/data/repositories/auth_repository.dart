import 'dart:convert';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/utils/logger.dart';

final supabaseProvider = Provider((ref) => Supabase.instance.client);

/// Thrown when the account exists but email is not verified yet.
class EmailNotConfirmedException implements Exception {
  final String email;
  final String message;

  EmailNotConfirmedException({
    required this.email,
    this.message =
        'Debes verificar tu correo antes de iniciar sesión. Revisa tu bandeja (y spam).',
  });

  @override
  String toString() => message;
}

class SupabaseAuthRepository {
  final SupabaseClient _client;
  SupabaseAuthRepository(this._client);

  // El registro/login del movil pasa por el backend web (service_role).
  //
  // Local emulator default: http://10.0.2.2:8080
  // Production / physical device: pass ONE base URL, e.g.
  //   flutter run --dart-define=API_BASE_URL=https://tu-app.vercel.app
  // Optional per-endpoint overrides: AUTH_REGISTER_ENDPOINT, AUTH_SYNC_ENDPOINT,
  // AUTH_RESEND_CONFIRMATION_ENDPOINT.
  static const _apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8080',
  );

  static String get _authRegisterEndpoint {
    const override = String.fromEnvironment('AUTH_REGISTER_ENDPOINT');
    if (override.isNotEmpty) return override;
    return '$_apiBaseUrl/api/auth/register';
  }

  static String get _authSyncEndpoint {
    const override = String.fromEnvironment('AUTH_SYNC_ENDPOINT');
    if (override.isNotEmpty) return override;
    return '$_apiBaseUrl/api/auth/sync';
  }

  static String get _authResendConfirmationEndpoint {
    const override = String.fromEnvironment('AUTH_RESEND_CONFIRMATION_ENDPOINT');
    if (override.isNotEmpty) return override;
    return '$_apiBaseUrl/api/auth/resend-confirmation';
  }

  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;
  User? get currentUser => _client.auth.currentUser;

  Future<AuthResponse> signIn({required String email, required String password}) async {
    final normalizedEmail = email.trim().toLowerCase();
    try {
      final response = await _client.auth.signInWithPassword(
        email: normalizedEmail,
        password: password,
      );
      await _ensureProfileLinked(normalizedEmail, password, response.user?.id);
      return response;
    } on AuthException catch (e, stack) {
      // Email not confirmed: do NOT sync/bypass. Surface a clear error + resend UI.
      if (_isEmailNotConfirmed(e.message)) {
        throw EmailNotConfirmedException(email: normalizedEmail);
      }

      // Legacy accounts: public.users exists but Auth user was never created.
      // Sync only for invalid credentials (never for unconfirmed).
      if (_shouldAttemptSync(e.message)) {
        try {
          await _syncAuthUserIfNeeded(normalizedEmail, password);
          final response = await _client.auth.signInWithPassword(
            email: normalizedEmail,
            password: password,
          );
          await _ensureProfileLinked(normalizedEmail, password, response.user?.id);
          return response;
        } on EmailNotConfirmedException {
          rethrow;
        } on AuthException catch (retryError) {
          if (_isEmailNotConfirmed(retryError.message)) {
            throw EmailNotConfirmedException(email: normalizedEmail);
          }
          AppLogger.error('AuthRepository: Error en signIn (post-sync)', retryError, stack);
          rethrow;
        }
      }

      AppLogger.error('AuthRepository: Error en signIn', e, stack);
      rethrow;
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error en signIn', e, stack);
      rethrow;
    }
  }

  /// Garantiza que la fila del usuario en `users` tenga su `auth_id` enlazado
  /// (necesario para RLS/RPCs que usan `auth.uid()`). Como la RLS impide al
  /// cliente escribir `auth_id`, si detectamos que aun no esta enlazado pedimos
  /// al backend (service_role) que lo haga via el endpoint de sync. Best-effort.
  Future<void> _ensureProfileLinked(String email, String password, String? authId) async {
    if (authId == null) return;
    try {
      final linked = await _client
          .from('users')
          .select('id')
          .eq('auth_id', authId)
          .maybeSingle();

      if (linked != null) return;

      await _syncAuthUserIfNeeded(email, password);
    } catch (e) {
      AppLogger.warn('AuthRepository: no se pudo verificar/enlazar el perfil de $email. $e');
    }
  }

  bool _isEmailNotConfirmed(String? errorMessage) {
    if (errorMessage == null) return false;
    final normalized = errorMessage.toLowerCase();
    return normalized.contains('email not confirmed') ||
        normalized.contains('email_not_confirmed');
  }

  bool _shouldAttemptSync(String? errorMessage) {
    if (errorMessage == null) return false;
    final normalized = errorMessage.toLowerCase();
    // IMPORTANT: never treat email_not_confirmed as a sync trigger.
    return normalized.contains('invalid login credentials') ||
        normalized.contains('invalid_credentials');
  }

  Future<void> _syncAuthUserIfNeeded(String email, String password) async {
    final uri = Uri.parse(_authSyncEndpoint);
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    final request = await client.postUrl(uri);
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'email': email,
      'password': password,
    }));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    if (response.statusCode == 200) {
      return;
    }

    var message = 'No se pudo sincronizar la cuenta.';
    String? code;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map) {
        if (decoded['message'] is String) message = decoded['message'] as String;
        if (decoded['code'] is String) code = decoded['code'] as String;
      }
    } catch (_) {}

    if (response.statusCode == 403 || code == 'EMAIL_NOT_CONFIRMED') {
      throw EmailNotConfirmedException(email: email, message: message);
    }

    AppLogger.warn('AuthRepository: Sync endpoint returned ${response.statusCode}: $body');
    throw Exception(message);
  }

  /// Result of a successful signup. [needsEmailConfirmation] is true when the
  /// user must verify email before logging in (normal path).
  Future<({bool needsEmailConfirmation, String email, bool emailSent, String? message})> signUp({
    required String email,
    required String password,
    required String username,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    try {
      final uri = Uri.parse(_authRegisterEndpoint);
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
      final request = await client.postUrl(uri);
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({
        'username': username,
        'email': normalizedEmail,
        'password': password,
      }));

      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();

      Map<String, dynamic>? decoded;
      try {
        final raw = jsonDecode(body);
        if (raw is Map<String, dynamic>) decoded = raw;
        if (raw is Map) decoded = Map<String, dynamic>.from(raw);
      } catch (_) {}

      if (response.statusCode == 201 || response.statusCode == 200) {
        final needsConfirm = decoded?['needsEmailConfirmation'] == true;
        return (
          needsEmailConfirmation: needsConfirm,
          email: (decoded?['email'] as String?) ?? normalizedEmail,
          emailSent: decoded?['emailSent'] != false,
          message: decoded?['message'] is String ? decoded!['message'] as String : null,
        );
      }

      var message = 'No se pudo crear la cuenta. Intenta nuevamente.';
      final code = decoded?['code'] as String?;
      if (decoded?['message'] is String) {
        message = decoded!['message'] as String;
      }

      if (code == 'EMAIL_NOT_CONFIRMED') {
        throw EmailNotConfirmedException(
          email: (decoded?['email'] as String?) ?? normalizedEmail,
          message: message,
        );
      }

      if (code == 'EMAIL_RATE_LIMIT' || response.statusCode == 429) {
        throw Exception(
          'Supabase limitó el envío de correos por demasiados intentos. Espera unos minutos (hasta ~1 hora) o prueba con otro correo.',
        );
      }

      AppLogger.error('AuthRepository: signUp fallo (${response.statusCode}): $body');
      throw Exception(message);
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error en signUp', e, stack);
      rethrow;
    }
  }

  Future<({bool alreadyConfirmed, String message})> resendConfirmationEmail({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    final uri = Uri.parse(_authResendConfirmationEndpoint);
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
    final request = await client.postUrl(uri);
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'email': normalizedEmail,
      'password': password,
    }));

    final response = await request.close();
    final body = await response.transform(utf8.decoder).join();

    Map<String, dynamic>? decoded;
    try {
      final raw = jsonDecode(body);
      if (raw is Map) decoded = Map<String, dynamic>.from(raw);
    } catch (_) {}

    if (response.statusCode == 200) {
      return (
        alreadyConfirmed: decoded?['alreadyConfirmed'] == true,
        message: (decoded?['message'] as String?) ??
            'Te reenviamos el correo de verificación.',
      );
    }

    throw Exception(
      (decoded?['message'] as String?) ??
          'No se pudo reenviar el correo de verificación.',
    );
  }

  Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error en signOut', e, stack);
      rethrow;
    }
  }

  Future<void> sendPasswordResetEmail({required String email}) async {
    try {
      final normalizedEmail = email.trim().toLowerCase();
      await _client.auth.resetPasswordForEmail(normalizedEmail);
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error sending password reset email', e, stack);
      rethrow;
    }
  }
}

final authRepositoryProvider = Provider((ref) => SupabaseAuthRepository(ref.watch(supabaseProvider)));

/// Emite cada evento de sesion de Supabase (login, logout, refresh de token).
final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

/// Usuario autenticado ACTUAL. Se recalcula cada vez que cambia la sesion, por
/// lo que cualquier provider que dependa del usuario debe basarse en este (y no
/// leer `currentUser` de forma imperativa) para no servir datos cacheados de
/// otra cuenta al cambiar de usuario sin reiniciar la app.
final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(authRepositoryProvider).currentUser;
});
