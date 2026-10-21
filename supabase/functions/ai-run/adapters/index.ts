import type { Adapter } from '../types.ts'
import { ProviderError, zeroUsage } from '../types.ts'
import { anthropicAdapter } from './anthropic.ts'
// Add a provider here with the same Adapter contract. Only this server registry reads secrets.
export function providerAdapter(provider: string, secret: (name: string) => string | undefined): Adapter {
  if (provider === 'anthropic') return anthropicAdapter(secret('ANTHROPIC_API_KEY') ?? '')
  throw new ProviderError('failed', zeroUsage)
}
