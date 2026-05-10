import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFFF6F7F3);
  static const Color foreground = Color(0xFF2C3524);
  static const Color paper = Color(0xFFF3F5ED);
  static const Color paperForeground = Color(0xFF333F2B);
  static const Color cream = Color(0xFFFAFBF6);
  static const Color ink = Color(0xFF283321);
  
  static const Color olive = Color(0xFF5D7349);
  static const Color oliveDeep = Color(0xFF3B4D2B);
  static const Color mint = Color(0xFFA5C59C);
  
  static const Color card = Color(0xFFFCFDF9);
  static const Color primary = Color(0xFF5A7840);
  static const Color primaryForeground = Color(0xFFFAFBF6);
  static const Color secondary = Color(0xFFE5E9DF);
  static const Color secondaryForeground = Color(0xFF3B4D2B);
  static const Color error = Color(0xFF993322);
  static const Color border = Color(0xFFDCE2D1);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      colorScheme: const ColorScheme.light(
        primary: primary,
        onPrimary: primaryForeground,
        secondary: secondary,
        onSecondary: secondaryForeground,
        surface: card,
        onSurface: foreground,
        error: error,
        onError: Colors.white,
      ),
      textTheme: TextTheme(
        displayLarge: GoogleFonts.fraunces(color: foreground),
        displayMedium: GoogleFonts.fraunces(color: foreground),
        displaySmall: GoogleFonts.fraunces(color: foreground),
        headlineLarge: GoogleFonts.fraunces(color: foreground),
        headlineMedium: GoogleFonts.fraunces(color: foreground),
        headlineSmall: GoogleFonts.fraunces(color: foreground),
        titleLarge: GoogleFonts.plusJakartaSans(color: foreground),
        titleMedium: GoogleFonts.plusJakartaSans(color: foreground),
        titleSmall: GoogleFonts.plusJakartaSans(color: foreground),
        bodyLarge: GoogleFonts.plusJakartaSans(color: foreground),
        bodyMedium: GoogleFonts.plusJakartaSans(color: foreground),
        bodySmall: GoogleFonts.plusJakartaSans(color: foreground),
        labelLarge: GoogleFonts.plusJakartaSans(color: foreground),
        labelMedium: GoogleFonts.plusJakartaSans(color: foreground),
        labelSmall: GoogleFonts.plusJakartaSans(color: foreground),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: foreground,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.fraunces(
          color: foreground,
          fontSize: 24,
          fontWeight: FontWeight.w600,
        ),
      ),
      cardTheme: CardThemeData(
        color: paper,
        elevation: 2,
        shadowColor: olive.withOpacity(0.12),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: border),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: primaryForeground,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
      ),
    );
  }
}
