import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Native file events are unreliable for this project path on Windows (edits were missed and
    // stale modules served); polling is slower but always correct.
    watch: { usePolling: true, interval: 250 },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) takes the function form only.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]three[\\/]/.test(id)) return 'three'
          if (/@react-three[\\/]/.test(id)) return 'r3f'
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
})
