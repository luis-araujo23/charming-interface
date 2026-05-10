import 'package:flutter/material.dart';

class MemoriesScreen extends StatelessWidget {
  const MemoriesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recuerdos')),
      body: const Center(child: Text('Recuerdos del pasado (Próximamente)')),
    );
  }
}
