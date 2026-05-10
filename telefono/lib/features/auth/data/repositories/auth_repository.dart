import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:telefono/core/utils/logger.dart';

final supabaseProvider = Provider((ref) => Supabase.instance.client);

class SupabaseAuthRepository {
  final SupabaseClient _client;
  SupabaseAuthRepository(this._client);

  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;
  User? get currentUser => _client.auth.currentUser;

  Future<AuthResponse> signIn({required String email, required String password}) async {
    try {
      return await _client.auth.signInWithPassword(email: email, password: password);
    } catch (e, stack) {
      AppLogger.error('AuthRepository: Error en signIn', e, stack);
      rethrow;
    }
  }

  Future<AuthResponse> signUp({required String email, required String password, required String username}) async {
    try {
      final response = await _client.auth.signUp(
        email: email, 
        password: password,
        data: {'username': username},
      );
      return response;
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
}

final authRepositoryProvider = Provider((ref) => SupabaseAuthRepository(ref.watch(supabaseProvider)));
