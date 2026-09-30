import type { ProviderName } from '@/types'

export const AVAILABLE_MODELS: Record<ProviderName, readonly { id: string; label: string; capabilities: readonly ('text' | 'vision')[] }[]> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', capabilities: ['text', 'vision'] },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', capabilities: ['text', 'vision'] },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', capabilities: ['text'] },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', capabilities: ['text'] },
  ],
  openrouter: [
    { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini', capabilities: ['text', 'vision'] },
    { id: 'google/gemini-2.0-flash-001', label: 'Google Gemini 2.0 Flash', capabilities: ['text', 'vision'] },
  ],
}

export type ModelConfiguration = Record<ProviderName, { enabled: string[]; defaultModel: string }>

export const DEFAULT_MODEL_CONFIGURATION: ModelConfiguration = {
  gemini: { enabled: ['gemini-2.0-flash', 'gemini-2.5-flash'], defaultModel: 'gemini-2.0-flash' },
  groq: { enabled: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], defaultModel: 'llama-3.3-70b-versatile' },
  openrouter: { enabled: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001'], defaultModel: 'openai/gpt-4o-mini' },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateModelConfiguration(value: unknown): ModelConfiguration | null {
  if (!isRecord(value)) return null
  const result = {} as ModelConfiguration
  for (const provider of Object.keys(AVAILABLE_MODELS) as ProviderName[]) {
    const providerValue = value[provider]
    if (!isRecord(providerValue) || !Array.isArray(providerValue.enabled) || typeof providerValue.defaultModel !== 'string') return null
    const allowlist = AVAILABLE_MODELS[provider].map(model => model.id)
    if (providerValue.enabled.length === 0 || providerValue.enabled.some(model => typeof model !== 'string' || !allowlist.includes(model))) return null
    const enabled = [...new Set(providerValue.enabled as string[])]
    if (!enabled.includes(providerValue.defaultModel)) return null
    result[provider] = { enabled, defaultModel: providerValue.defaultModel }
  }
  return result
}
