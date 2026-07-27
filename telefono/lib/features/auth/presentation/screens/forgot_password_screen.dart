import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _emailController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _emailController.text.trim().toLowerCase();
    if (email.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Escribe tu correo.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final message = await ref.read(authRepositoryProvider).requestPasswordReset(email: email);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: AppTheme.olive),
      );
    } catch (e) {
      if (!mounted) return;
      final raw = e.toString();
      final message = raw.startsWith('Exception: ') ? raw.substring('Exception: '.length) : raw;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: AppTheme.error),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
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
                    'Recupera el acceso a tu diario',
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
                          'Recuperar contraseña',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontFamily: 'Fraunces',
                              ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Te enviaremos un enlace a tu correo. Ábrelo en el navegador para crear una nueva contraseña.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
                        ),
                        const SizedBox(height: 24),
                        TextField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          decoration: const InputDecoration(
                            labelText: 'Correo electrónico',
                            hintText: 'ejemplo@correo.com',
                          ),
                        ),
                        const SizedBox(height: 28),
                        ElevatedButton(
                          onPressed: _isLoading ? null : _submit,
                          child: _isLoading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text('Enviar enlace'),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          child: const Text(
                            'Volver a iniciar sesión',
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
}
