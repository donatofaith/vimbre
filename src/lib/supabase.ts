import { createClient } from '@supabase/supabase-js'
import { validatePublicConfig } from './env'

const config = validatePublicConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
/** Null until configured. No network calls or mock records are created by the scaffold. */
export const supabase = config.ok ? createClient(config.value.url, config.value.key) : null
export const supabaseConfigurationError = config.ok ? null : config.error
