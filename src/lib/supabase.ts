import { createClient } from '@supabase/supabase-js'
import { validatePublicConfig } from './env'
import { developmentProject } from './public-project'
import type { Database } from './database'
const config = validatePublicConfig(import.meta.env.VITE_SUPABASE_URL ?? developmentProject.url, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? developmentProject.key)
if (!config.ok) throw new Error(config.error)
// Invitations start on a different device; their Auth email links use the implicit flow.
const emailLink = typeof window !== 'undefined' && window.location.pathname === '/auth/callback' && new URLSearchParams(window.location.hash.slice(1)).has('access_token')
export const supabase = createClient<Database>(config.value.url, config.value.key, {
  auth: { flowType: emailLink ? 'implicit' : 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
