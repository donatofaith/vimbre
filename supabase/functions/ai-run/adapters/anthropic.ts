import type { Adapter, AdapterInput, AdapterOutput, Usage } from '../types.ts'
import { ProviderError, zeroUsage } from '../types.ts'
const endpoint = 'https://api.anthropic.com/v1/messages'
const maxInputTokens = 32768
function tokens(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0 }
export function anthropicAdapter(key: string, request: typeof fetch = fetch): Adapter {
  return { async generate(input: AdapterInput): Promise<AdapterOutput> {
    let dispatched = false
    let measured: Usage | null = null
    try {
      if (!key || input.temperature !== null) throw new ProviderError('failed', zeroUsage)
      const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
      const prompt = { model: input.model.model_name, system: input.system, messages: [{ role: 'user', content: input.text }] }
      // Free preflight keeps Haiku below its 100k-token pricing tier and bounds reservations.
      const countResponse = await request(`${endpoint}/count_tokens`, { method: 'POST', headers, body: JSON.stringify(prompt), signal: input.signal })
      if (!countResponse.ok) throw new ProviderError('failed', zeroUsage)
      const count = await countResponse.json()
      if (!tokens(count.input_tokens) || count.input_tokens > maxInputTokens) throw new ProviderError('failed', zeroUsage)
      input.signal.throwIfAborted()
      dispatched = true; input.onDispatch()
      // Claude 5.5 rejects custom sampling parameters. No tools, caching or paid extras.
      const response = await request(endpoint, { method: 'POST', headers, body: JSON.stringify({ ...prompt, max_tokens: input.maxOutputTokens }), signal: input.signal })
      if (!response.ok) throw new ProviderError('failed', response.status >= 400 && response.status < 500 ? zeroUsage : null)
      const body = await response.json()
      if (tokens(body.usage?.input_tokens) && tokens(body.usage?.output_tokens)) measured = { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens }
      if (!measured || (body.model !== input.model.model_name && !(typeof body.model === 'string' && new RegExp(`^${input.model.model_name}-[0-9]{8}$`).test(body.model))) || !Array.isArray(body.content)) throw new ProviderError('failed', measured)
      const text = body.content.filter((block: {type?: string; text?: unknown}) => block.type === 'text' && typeof block.text === 'string').map((block: {text: string}) => block.text).join('\n').trim()
      return { ...measured, text, model: body.model, stopReason: body.stop_reason }
    } catch (error) {
      if (error instanceof ProviderError) throw error
      throw new ProviderError(input.signal.aborted ? 'timeout' : 'failed', dispatched ? measured : zeroUsage)
    }
  } }
}
