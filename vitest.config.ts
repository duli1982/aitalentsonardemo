import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react() as any],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        include: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json', 'lcov'],
            exclude: [
                'node_modules/',
                'src/test/',
                '**/*.test.ts',
                '**/*.test.tsx',
                '**/*.spec.ts',
                '**/*.spec.tsx',
                '**/dist/**',
                '**/build/**',
                '**/*.config.ts',
                '**/*.config.js'
            ],
            thresholds: {
                statements: 80,
                branches: 75,
                functions: 80,
                lines: 80
            },
            all: true,
            clean: true
        },
        testTimeout: 10000,
        hookTimeout: 10000
    },
});
