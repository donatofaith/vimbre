import { relative, resolve } from 'node:path'
import { validatePublicConfig } from '../src/lib/env.ts'

const publicNames = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_TURNSTILE_SITE_KEY', 'VITE_CAPTURE_RECORDING_ENABLED'])

/** Fail before Vite transforms client modules. Never echo supplied values. */
export function assertPublicEnvironment(env: Record<string, string | undefined>) {
  if (Object.keys(env).some(name => name.startsWith('VITE_') && !publicNames.has(name))) {
    throw new Error('Unapproved VITE_ variable. Keep credentials in server environment variables.')
  }
  if (env.VITE_CAPTURE_RECORDING_ENABLED && !['true', 'false'].includes(env.VITE_CAPTURE_RECORDING_ENABLED)) {
    throw new Error('Invalid public Capture recording switch.')
  }
  if (env.VITE_TURNSTILE_SITE_KEY?.trim() && !/^[013]x[0-9A-Za-z_-]{22}$/.test(env.VITE_TURNSTILE_SITE_KEY.trim())) {
    throw new Error('Invalid public Turnstile site key.')
  }
  if (env.VITE_SUPABASE_URL && !validatePublicConfig(env.VITE_SUPABASE_URL, 'sb_publishable_validation_only').ok) {
    throw new Error('Invalid public Supabase URL.')
  }
  if (env.VITE_SUPABASE_PUBLISHABLE_KEY && !validatePublicConfig('https://project.supabase.co', env.VITE_SUPABASE_PUBLISHABLE_KEY).ok) {
    throw new Error('Invalid public Supabase key. Private credentials cannot be bundled.')
  }
}

export function assertClientModule(id: string, root: string) {
  const file = id.split('?')[0].replaceAll('\\', '/')
  const path = relative(resolve(root), file).replaceAll('\\', '/')
  if (/^(?:supabase\/functions|api|email-worker|server|scripts)\//.test(path) || /\.server\.[cm]?[jt]sx?$/.test(path)) {
    throw new Error('Server code cannot be imported into the frontend.')
  }
}
