# Kitty (teléfono)

App Flutter que usa Supabase Auth + el backend web (`/api/auth/*`) para registro, sync y reenvío de verificación.

## Desarrollo local (emulador Android)

1. Arranca la web: `cd web && npm run dev`
2. Corre la app (default apunta a `http://10.0.2.2:8080`):

```bash
cd telefono
flutter run
```

## Contra Vercel (producción / teléfono físico)

```bash
flutter run --dart-define=API_BASE_URL=https://TU-PROYECTO.vercel.app
flutter build apk --dart-define=API_BASE_URL=https://TU-PROYECTO.vercel.app
```

Eso configura register, sync y resend-confirmation automáticamente.

## Verificación de correo

1. Registro → llega correo de Supabase (revisa spam)
2. Abrir el enlace → aterriza en `https://TU-PROYECTO.vercel.app/auth/confirmed`
3. Iniciar sesión en web o app
