import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Target moderno — descarta polyfills innecesarios
    target: 'es2020',
    // Avisar si un chunk supera 400KB (README §13: initial bundle < 150KB gzipped)
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        // DECISIÓN: manualChunks divide vendors pesados en chunks separados.
        // Recharts y React Router son lo suficientemente grandes para justificarlo.
        // El usuario descarga cada chunk solo cuando navega a la ruta que lo necesita.
        manualChunks: {
          // Core de React — siempre necesario
          'vendor-react': ['react', 'react-dom'],
          // Router — carga con la app
          'vendor-router': ['react-router-dom'],
          // State y server state — carga con la app
          'vendor-state': ['zustand', '@tanstack/react-query'],
          // Charts — solo cuando el usuario va a /dashboard o /analytics
          'vendor-charts': ['recharts'],
          // Formularios
          'vendor-forms': ['react-hook-form', '@hookform/resolvers'],
          // i18n
          'vendor-i18n': ['i18next', 'react-i18next'],
          // Animaciones
          'vendor-motion': ['framer-motion'],
        },
      },
    },
  },
});
