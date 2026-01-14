import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPluginModule from 'vite-plugin-monaco-editor';
import viteCompression from 'vite-plugin-compression';

// Fix for CommonJS/ESM compatibility
const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule;

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // Relative base path for Electron
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        monacoEditorPlugin({
          languages: ['json', 'shell', 'yaml', 'markdown'],
          features: ['bracketMatching', 'clipboard', 'comment', 'contextmenu', 'coreCommands', 'find', 'folding', 'gotoLine', 'hover', 'indentation', 'links', 'suggest'],
        }),
        viteCompression({
          verbose: false,
          threshold: 1024,
          algorithm: 'gzip',
          ext: '.gz',
          deleteOriginFile: false
        })
      ],
      define: {
        'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'import.meta.env.VITE_OPENAI_BASE_URL': JSON.stringify(env.OPENAI_BASE_URL),
        'import.meta.env.VITE_OPENAI_MODEL': JSON.stringify(env.OPENAI_MODEL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: 'esbuild',
        sourcemap: false,
        cssCodeSplit: true,
        assetsInlineLimit: 4096,
        reportCompressedSize: false,
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react')) return 'vendor-react';
                if (id.includes('monaco-editor')) return 'vendor-monaco';
                if (id.includes('xterm')) return 'vendor-xterm';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('openai') || id.includes('markdown') || id.includes('syntax-highlighter')) return 'vendor-ai';
                return 'vendor';
              }
            },
            assetFileNames: 'assets/[name]-[hash][extname]',
            chunkFileNames: 'assets/[name]-[hash].js',
            entryFileNames: 'assets/[name]-[hash].js',
          }
        }
      }
    };
});
