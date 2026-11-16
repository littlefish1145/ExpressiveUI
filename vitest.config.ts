import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components'];
export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@amiracle1024/theme/runtime',
        replacement: fileURLToPath(new URL('./packages/theme/src/runtime.ts', import.meta.url)),
      },
      ...names.map((name) => ({
        find: `@amiracle1024/${name}`,
        replacement: fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url)),
      })),
    ],
  },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'happy-dom', restoreMocks: true },
});
