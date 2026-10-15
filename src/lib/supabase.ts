import { createClient } from '@supabase/supabase-js'
import { validatePublicConfig } from './env'
import { developmentProject } from './public-project'
import type { Database } from './database.types'
const config = validatePublicConfig(import.meta.env.VITE_SUPABASE_URL ?? developmentProject.url, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? developmentProject.key)
if (!config.ok) throw new Error(config.error)
export const supabase = createClient<Database>(config.value.url, config.value.key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
