import 'dart:convert';
import 'dart:io';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/utils/logger.dart';

final supabaseProvider = Provider((ref) => Supabase.instance.client);

class SupabaseAuthRepository {
  final SupabaseClient _client;
  SupabaseAuthRepository(this._client);

  // El registro/login del movil pasa por el backend web, que usa la
  // service_role y puede escribir en la tabla `users` saltando la RLS.
  // Nota: el emulador Android accede al host via 10.0.2.2 y el server corre en
  // el puerto 8080. Para dispositivo fisico, pasa la IP con --dart-define.
  static const _authRegisterEndpoint = String.fromEnvironment(
    'AUTH_REGISTER_ENDPOINT',
    defaultValue: 'http://10.0.2.2:8080/api/auth/register',
  );

  static const _authSyncEndpoint = String.fromEnvironment(
    'AUTH_SYNC_ENDPOINT',
    defaultValue: 'http://10.0.2.2:8080/api/auth/sync',
  );

  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;
  User? get currentUser => _client.auth.currentUser;

  Future<AuthResponse> signIn({required String email, required String password}) async {
    final normalizedEmail = email.trim().toLowerCase();
    try {
      final response = await _client.auth.signInWithPassword(email: normalizedEmail, password: password);
      await _ensureProfileLinked(normalizedEmail, password, response.user?.id);
      return response;
    } on AuthException catch (e, stack) {
      if (_shouldAttemptSync(e.message)) {
        final synced = await _syncAuthUserIfNeeded(normalizedEmail, password);
        if (synced) {
          final response = await _client.auth.signInWithPassword(email: normalizedEmail, password: password);
          await _ensureProfileLinked(normalizedEmail, password, response.user?.id);
          return response;
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

      if (linked != null) return; // Ya esta enlazado.

      await _syncAuthUserIfNeeded(email, password);
    } catch (e) {
      AppLogger.warn('AuthRepository: no se pudo verificar/enlazar el perfil de $email. $e');
    }
  }

  bool _shouldAttemptSync(String? errorMessage) {
    if (errorMessage == null) return false;
    final normalized = errorMessage.toLowerCase();
    return normalized.contains('invalid login credentials') ||
        normalized.contains('invalid_credentials') ||
        normalized.contains('email not confirmed') ||
        normalized.contains('email_not_confirmed');
  }

  Future<bool> _syncAuthUserIfNeeded(String email, String password) async {
    try {
      final uri = Uri.parse(_authSyncEndpoint);
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
      final request = await client.postUrl(uri);
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode({
        'email': email,
        'password': password,
      }));

      final response = await request.close();
      if (response.statusCode == 200) {
        return true;
      }

      final body = await response.transform(utf8.decoder).join();
      AppLogger.warn('AuthRepository: Sync endpoint returned ${response.statusCode}: $body');
      return false;
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error sincronizando cuenta Auth', e, stack);
      return false;
    }
  }

  Future<void> signUp({required String email, required String password, required String username}) async {
    final normalizedEmail = email.trim().toLowerCase();
    try {
      // La RLS de `users` bloquea inserts anonimos desde el cliente, asi que el
      // registro se hace en el backend web (service_role). El hash bcrypt y la
      // creacion de la fila en `users` ocurren alli. El usuario de Supabase Auth
      // se crea de forma diferida en el primer login (via /api/auth/sync).
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

      if (response.statusCode == 201 || response.statusCode == 200) {
        return;
      }

      var message = 'No se pudo crear la cuenta. Intenta nuevamente.';
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {
        // Cuerpo no-JSON: usamos el mensaje generico.
      }

      AppLogger.error('AuthRepository: signUp fallo (${response.statusCode}): $body');
      throw Exception(message);
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error en signUp', e, stack);
      rethrow;
    }
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
