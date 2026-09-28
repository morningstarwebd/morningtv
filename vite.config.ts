import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: [
        '**/src-tauri/**',
        '**/target/**',
        '**/playlists/**',
        '**/*.m3u',
        '**/*.dll',
        '**/*.exe',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('hls.js')) return 'vendor-hls';
            if (id.includes('react-dom') || id.includes('/react/') || id.endsWith('/react')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('@tauri-apps')) return 'vendor-tauri';
            return 'vendor';
          }
        },
      },
    },
  },
})
