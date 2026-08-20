import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Les routes API importent par l'alias @/ défini dans tsconfig.json ; Vitest ne lit
// pas les paths TypeScript, il faut le lui redonner ici.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
