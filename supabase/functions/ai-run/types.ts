export type Model = { id: string; provider: string; model_name: string; input_price_per_million: number; output_price_per_million: number; enabled: boolean }
export type Usage = { inputTokens: number; outputTokens: number }
export type AIDocument = { media_type: 'application/pdf'; data: string }
export type AdapterInput = { document?: AIDocument; model: Model; system: string; text: string; maxOutputTokens: number; temperature: number | null; signal: AbortSignal; onDispatch: () => void }
export type AdapterOutput = Usage & { text: string; model: string; stopReason: string }
export type Adapter = { generate: (input: AdapterInput) => Promise<AdapterOutput> }
export type Route = { task: string; max_output_tokens: number; temperature: number | null; primary: Model; fallback: Model | null }
export type Reservation = { ok: boolean; code?: string; period?: 'day' | 'month'; reset_at?: string; usage_id?: string; company_id?: string; route?: Route }
export type Attempt = { model_id: string; input_tokens: number | null; output_tokens: number | null; outcome: 'success' | 'failed' | 'timeout' }
export class ProviderError extends Error {
  readonly kind: 'failed' | 'timeout'
  readonly usage: Usage | null
  constructor(kind: 'failed' | 'timeout', usage: Usage | null = null) { super('AI provider unavailable');this.kind=kind;this.usage=usage }
}
export const zeroUsage = { inputTokens: 0, outputTokens: 0 }

