import { defineConfig } from 'tsup';

// Bundles the server (and the shared workspace package it imports) into dist/.
// npm dependencies such as Prisma and Express stay external.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'create-admin': 'src/scripts/create-admin.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@busify/shared'],
});
