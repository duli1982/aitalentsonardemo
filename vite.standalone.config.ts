
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Note: In a real production setup, we would use vite-plugin-singlefile 
// to inline all assets for Google Apps Script.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: 'dist-standalone',
        lib: {
            entry: resolve(__dirname, 'standalone/index.ts'),
            name: 'SonarStandalone',
            fileName: 'sonar-standalone',
            formats: ['iife'] // Browser-friendly format for GAS
        },
        rollupOptions: {
            output: {
                inlineDynamicImports: true
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, '.')
        }
    }
});
