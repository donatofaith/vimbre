import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { assertClientModule, assertPublicEnvironment } from './scripts/public-env.ts'

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root, 'VITE_')
  if (process.env.VERCEL === '1') {
    for (const name of Object.keys(env)) {
      if (name.startsWith('VITE_VERCEL_')) delete env[name]
    }
  }
  assertPublicEnvironment(env)
  return {
    // Publish only explicitly checked values, even when the host injects VITE_ metadata.
    envPrefix: [],
    define: Object.fromEntries(Object.entries(env).map(([name, value]) =>
      ['import.meta.env.' + name, JSON.stringify(value)])),
    plugins: [react(), {
      name: 'vimbre-client-secret-boundary',
      enforce: 'pre',
      apply: 'build',
      transform(_code, id) { assertClientModule(id, root) },
    }],
    server: { allowedHosts: ['terminal.local'] },
    build: { manifest: true, sourcemap: false },
  }
})
