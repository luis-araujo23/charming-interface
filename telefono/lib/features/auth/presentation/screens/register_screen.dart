import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/widgets/paper_card.dart';
import 'package:telefono/features/auth/data/repositories/auth_repository.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;

  String _mapRegisterError(Object error) {
    final message = error.toString().toLowerCase();
    if (message.contains('user already registered') || message.contains('ya existe')) {
      return 'Ese usuario o correo ya esta registrado.';
    }
    if (message.contains('password should be at least') || message.contains('al menos')) {
      return 'La contrasena es demasiado corta (minimo 8 caracteres).';
    }
    if (message.contains('socketexception') ||
        message.contains('connection') ||
        message.contains('failed host lookup')) {
      return 'No se pudo conectar con el servidor. Verifica que el servidor web este activo.';
    }

    return 'No se pudo crear la cuenta. Intenta nuevamente.';
  }

  Future<void> _register() async {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text.trim();

    if (username.isEmpty || email.isEmpty || password.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Completa usuario, correo y contrasena.'), backgroundColor: AppTheme.error),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      await ref.read(authRepositoryProvider).signUp(
        email: email,
        password: password,
        username: username,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cuenta creada con exito. Ya puedes iniciar sesion.'),
            backgroundColor: AppTheme.olive,
          ),
        );
        context.go('/login');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_mapRegisterError(e)), backgroundColor: AppTheme.error),
        );
      }
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
            center: const Alignment(0.6, -0.8),
            radius: 1.5,
            colors: [
              AppTheme.mint.withOpacity(0.08),
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
                    'Empieza tu viaje hoy mismo',
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
                          'Crear Cuenta',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontFamily: 'Fraunces',
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildTextField(
                          controller: _usernameController,
                          label: 'Nombre de Usuario',
                          hint: 'tu_nombre',
                        ),
                        const SizedBox(height: 16),
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
                          onPressed: _isLoading ? null : _register,
                          child: _isLoading 
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Registrarse'),
                        ),
                        const SizedBox(height: 16),
                        TextButton(
                          onPressed: () => context.pop(),
                          child: const Text(
                            '¿Ya tienes cuenta? Inicia sesión',
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
