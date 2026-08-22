import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-xterm': [
                'xterm',
                'xterm-addon-canvas',
                'xterm-addon-fit',
                'xterm-addon-search',
                'xterm-addon-web-links',
                'xterm-addon-webgl'
              ],
              'vendor-utils': ['socket.io-client', 'zustand', 'i18next', 'react-i18next'],
              'vendor-ai': ['react-markdown', 'react-syntax-highlighter'],
              'vendor-ui': ['lucide-react']
            }
          }
        }
      }
    };
});
