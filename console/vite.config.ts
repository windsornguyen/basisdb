import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BASISDB_')
  const backend = new URL(env.BASISDB_API_URL ?? 'http://127.0.0.1:19090')
  if (!['http:', 'https:'].includes(backend.protocol)) {
    throw new Error('BASISDB_API_URL must use HTTP or HTTPS')
  }
  return {
    base: './',
    plugins: [react()],
    server: {
      port: 4173,
      strictPort: true,
      proxy: {
        '/basisdb.kv.v1.KvService/': { target: backend.origin, changeOrigin: true },
      },
    },
  }
})
