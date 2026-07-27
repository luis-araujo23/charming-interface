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
import 'package:url_launcher/url_launcher.dart';

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
  bool _isResendingConfirmation = false;
  bool _needsConfirmation = false;
  String? _confirmLink;

  String _mapLoginError(Object error) {
    if (error is EmailNotConfirmedException) {
      return error.message;
    }
    final message = error.toString().toLowerCase();
    if (message.contains('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }
    if (message.contains('email not confirmed') || message.contains('email_not_confirmed')) {
      return 'Debes verificar tu correo antes de iniciar sesion. Revisa tu bandeja (y spam).';
    }
    if (message.contains('socketexception') ||
        message.contains('connection') ||
        message.contains('failed host lookup')) {
      return 'No se pudo conectar con el servidor. Verifica que el servidor web este activo.';
    }

    final raw = error.toString();
    if (raw.startsWith('Exception: ')) {
      return raw.substring('Exception: '.length);
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

    setState(() {
      _isLoading = true;
      _needsConfirmation = false;
    });
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
      ref.invalidate(diaryEntriesProvider);
      ref.invalidate(pendingFriendRequestsCountProvider);
      ref.invalidate(acceptedFriendsProvider);
      if (mounted) context.go('/diary');
    } on EmailNotConfirmedException catch (e) {
      if (mounted) {
        setState(() => _needsConfirmation = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: AppTheme.error),
        );
      }
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

  Future<void> _resendConfirmation() async {
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Escribe correo y contraseña para reenviar la verificación.'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
      return;
    }

    setState(() => _isResendingConfirmation = true);
    try {
      final result = await ref.read(authRepositoryProvider).resendConfirmationEmail(
            email: email,
            password: password,
          );
      if (mounted) {
        setState(() {
          if (result.alreadyConfirmed) {
            _needsConfirmation = false;
            _confirmLink = null;
          } else {
            _confirmLink = result.confirmLink;
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message), backgroundColor: AppTheme.olive),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_mapLoginError(e)),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isResendingConfirmation = false);
    }
  }

  Future<void> _openConfirmLink() async {
    final link = _confirmLink;
    if (link == null || link.isEmpty) return;
    final uri = Uri.tryParse(link);
    if (uri == null) return;
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No se pudo abrir el enlace.'),
          backgroundColor: AppTheme.error,
        ),
      );
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
                        if (_needsConfirmation) ...[
                          const SizedBox(height: 8),
                          OutlinedButton(
                            onPressed: _isResendingConfirmation ? null : _resendConfirmation,
                            child: _isResendingConfirmation
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : const Text('Obtener enlace de verificación'),
                          ),
                          if (_confirmLink != null) ...[
                            const SizedBox(height: 8),
                            ElevatedButton(
                              onPressed: _openConfirmLink,
                              child: const Text('Verificar ahora'),
                            ),
                          ],
                        ],
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
