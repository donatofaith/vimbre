import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { assertClientModule, assertPublicEnvironment } from './scripts/public-env.ts'

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  assertPublicEnvironment(loadEnv(mode, root, 'VITE_'))
  return {
    plugins: [react(), {
      name: 'vimbre-client-secret-boundary',
      enforce: 'pre',
      apply: 'build',
      transform(_code, id) { assertClientModule(id, root) },
    }],
    server: { allowedHosts: ['terminal.local'] },
    build: { manifest: true },
  }
})
