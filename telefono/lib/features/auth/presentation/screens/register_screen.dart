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
  String? _pendingEmail;
  String? _pendingWarning;

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  String _mapRegisterError(Object error) {
    if (error is EmailNotConfirmedException) {
      return error.message;
    }
    final message = error.toString().toLowerCase();
    if (message.contains('nombre de usuario') || message.contains('username')) {
      return 'Ese nombre de usuario ya esta en uso. Elige otro.';
    }
    if (message.contains('correo ya esta registrado') ||
        message.contains('correo ya está registrado')) {
      return 'Ese correo ya esta registrado. Inicia sesion o recupera tu contrasena.';
    }
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

    final raw = error.toString();
    if (raw.startsWith('Exception: ')) {
      return raw.substring('Exception: '.length);
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
          const SnackBar(
            content: Text('Completa usuario, correo y contrasena.'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      final result = await ref.read(authRepositoryProvider).signUp(
            email: email,
            password: password,
            username: username,
          );

      if (!mounted) return;

      if (result.needsEmailConfirmation) {
        setState(() {
          _pendingEmail = result.email;
          _pendingWarning = result.emailSent ? null : result.message;
        });
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cuenta creada. Ya puedes iniciar sesion.'),
          backgroundColor: AppTheme.olive,
        ),
      );
      context.go('/login');
    } on EmailNotConfirmedException catch (e) {
      if (mounted) {
        setState(() {
          _pendingEmail = e.email;
          _pendingWarning = e.message;
        });
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
                    _pendingEmail == null
                        ? 'Empieza tu viaje hoy mismo'
                        : 'Verifica tu correo para continuar',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppTheme.olive,
                        ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 48),
                  PaperCard(
                    padding: const EdgeInsets.all(32),
                    child: _pendingEmail != null
                        ? _buildPendingConfirmation()
                        : _buildRegisterForm(),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPendingConfirmation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Revisa tu correo',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontFamily: 'Fraunces',
              ),
        ),
        const SizedBox(height: 16),
        if (_pendingWarning != null) ...[
          Text(
            _pendingWarning!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.5,
                  color: AppTheme.error,
                ),
          ),
          const SizedBox(height: 12),
          Text(
            'Tu cuenta (${_pendingEmail!}) ya esta creada. Cuando pase el limite, '
            'en Iniciar sesion usa Reenviar correo de verificacion.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
          ),
        ] else ...[
          Text(
            'Te enviamos un enlace de verificacion a ${_pendingEmail!}. '
            'Abrelo, confirma tu cuenta y luego inicia sesion.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5),
          ),
          const SizedBox(height: 12),
          Text(
            'Si no lo ves, revisa la carpeta de spam.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.olive),
          ),
        ],
        const SizedBox(height: 28),
        ElevatedButton(
          onPressed: () => context.go('/login'),
          child: const Text('Ir a iniciar sesion'),
        ),
        TextButton(
          onPressed: () => setState(() {
            _pendingEmail = null;
            _pendingWarning = null;
          }),
          child: const Text(
            'Volver al registro',
            style: TextStyle(color: AppTheme.olive),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
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
        const SizedBox(height: 12),
        Text(
          'Te enviaremos un correo para verificar tu cuenta antes de poder entrar.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.olive),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _isLoading ? null : _register,
          child: _isLoading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
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
