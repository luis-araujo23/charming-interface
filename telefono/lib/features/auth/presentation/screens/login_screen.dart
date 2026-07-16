import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';
import 'package:telefono/features/diary/data/repositories/diary_repository.dart';
import 'package:telefono/features/friends/data/friends_providers.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  bool _isSendingReset = false;

  String _mapLoginError(Object error) {
    final message = error.toString().toLowerCase();
    if (message.contains('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }
    if (message.contains('email not confirmed') || message.contains('email_not_confirmed')) {
      return 'No se pudo validar la cuenta. Verifica que el servidor web este activo e intenta de nuevo.';
    }
    if (message.contains('socketexception') ||
        message.contains('connection') ||
        message.contains('failed host lookup')) {
      return 'No se pudo conectar con el servidor. Verifica que el servidor web este activo.';
    }

    return 'No se pudo iniciar sesion. Intenta nuevamente.';
  }

  Future<void> _login() async {
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Completa correo y contrasena.'), backgroundColor: AppTheme.error),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      // Quick pre-check: if a users row exists but has no password_hash,
      // the account likely does not have an email/password credential set.
      try {
        final profile = await Supabase.instance.client
            .from('users')
            .select('password_hash')
            .eq('email', email)
            .maybeSingle();

        if (profile != null && (profile['password_hash'] == null || profile['password_hash'] == '')) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Esta cuenta no tiene contraseña establecida. Usa "Recuperar contraseña" o regístrate de nuevo.'),
                backgroundColor: AppTheme.error,
              ),
            );
          }
          return;
        }
      } catch (_) {
        // If the check fails, continue and let signIn show the real error.
      }

      await ref.read(authRepositoryProvider).signIn(
        email: email,
        password: password,
      );
      // Descarta cualquier dato cacheado de una sesion anterior para que el
      // diario/amigos se recarguen para ESTA cuenta.
      ref.invalidate(diaryEntriesProvider);
      ref.invalidate(pendingFriendRequestsCountProvider);
      ref.invalidate(acceptedFriendsProvider);
      if (mounted) context.go('/diary');
    } catch (e) {
      if (mounted) {
        final msg = _mapLoginError(e);
        final debugSuffix = kDebugMode ? '\n(${e.toString()})' : '';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$msg$debugSuffix'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _sendPasswordReset() async {
    final email = _emailController.text.trim().toLowerCase();
    if (email.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ingresa tu correo para enviar el enlace de restablecimiento.'), backgroundColor: AppTheme.error),
        );
      }
      return;
    }

    setState(() => _isSendingReset = true);
    try {
      await ref.read(authRepositoryProvider).sendPasswordResetEmail(email: email);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Correo de restablecimiento enviado. Revisa tu bandeja.'), backgroundColor: AppTheme.olive),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('No se pudo enviar el correo: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isSendingReset = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(-0.6, -0.8),
            radius: 1.5,
            colors: [
              AppTheme.olive.withOpacity(0.08),
              AppTheme.background,
            ],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Kitty',
                    style: Theme.of(context).textTheme.displayMedium?.copyWith(
                      color: AppTheme.oliveDeep,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tu espacio personal de recuerdos',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.olive,
                    ),
                  ),
                  const SizedBox(height: 48),
                  PaperCard(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Iniciar Sesión',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontFamily: 'Fraunces',
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildTextField(
                          controller: _emailController,
                          label: 'Correo Electrónico',
                          hint: 'ejemplo@correo.com',
                        ),
                        const SizedBox(height: 16),
                        _buildTextField(
                          controller: _passwordController,
                          label: 'Contraseña',
                          hint: '••••••••',
                          isPassword: true,
                        ),
                        const SizedBox(height: 32),
                        ElevatedButton(
                          onPressed: _isLoading ? null : _login,
                          child: _isLoading 
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Entrar'),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _isSendingReset ? null : _sendPasswordReset,
                          child: _isSendingReset ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('¿Olvidaste tu contraseña?'),
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () => context.push('/register'),
                          child: const Text(
                            '¿No tienes cuenta? Regístrate',
                            style: TextStyle(color: AppTheme.olive),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    bool isPassword = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: AppTheme.oliveDeep,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: isPassword,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: Colors.white.withOpacity(0.5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppTheme.olive, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
