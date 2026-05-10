import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:telefono/core/theme/app_theme.dart';
import 'package:telefono/core/router/app_router.dart';
import 'package:telefono/core/utils/logger.dart';

base class AppProviderObserver extends ProviderObserver {
  @override
  void didUpdateProvider(
    ProviderObserverContext context,
    Object? previousValue,
    Object? newValue,
  ) {
    if (newValue is AsyncError) {
      AppLogger.error(
        'Provider Error: ${context.provider.name ?? context.provider.runtimeType}',
        newValue.error,
        newValue.stackTrace,
      );
    }
  }

  @override
  void providerDidFail(
    ProviderObserverContext context,
    Object error,
    StackTrace stackTrace,
  ) {
    AppLogger.error(
      'Provider Failed: ${context.provider.name ?? context.provider.runtimeType}',
      error,
      stackTrace,
    );
  }
}

void main() async {
  // Catch Flutter framework errors
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    AppLogger.error('FLUTTER FRAMEWORK ERROR', details.exception, details.stack);
  };

  // Catch errors outside the Flutter framework (asynchronous errors)
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    AppLogger.error('PLATFORM ERROR (ASYNC)', error, stack);
    return true;
  };

  WidgetsFlutterBinding.ensureInitialized();
  
  AppLogger.info('Inicializando Supabase...');
  try {
    await Supabase.initialize(
      url: 'https://ozxoupeoslkcpitmojvb.supabase.co',
      anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eG91cGVvc2xrY3BpdG1vanZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTAwMTUsImV4cCI6MjA5MjUyNjAxNX0.4JCryvnOaJI6JkXx0Xk06IIbxwKpPE3Gr5jyd5n2c9E',
    );
    AppLogger.info('Supabase inicializado correctamente.');
  } catch (e, stack) {
    AppLogger.error('Error inicializando Supabase', e, stack);
  }

  AppLogger.info('Iniciando aplicación...');
  
  runApp(
    ProviderScope(
      observers: [AppProviderObserver()],
      child: const MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Kitty',
      theme: AppTheme.lightTheme,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        return child!;
      },
    );
  }
}
