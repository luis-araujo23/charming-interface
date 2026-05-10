import 'package:flutter/material.dart';

class TaggedScreen extends StatelessWidget {
  const TaggedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Etiquetado')),
      body: const Center(child: Text('Notas donde te han etiquetado (Próximamente)')),
    );
  }
}
