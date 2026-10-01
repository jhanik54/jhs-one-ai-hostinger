import type { ProviderName } from '@/types'

export const AVAILABLE_MODELS: Record<ProviderName, readonly { id: string; label: string; capabilities: readonly ('text' | 'vision')[] }[]> = {
  gemini: [
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', capabilities: ['text', 'vision'] },
    { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', capabilities: ['text', 'vision'] },
  ],
  groq: [
    { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', capabilities: ['text'] },
    { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B', capabilities: ['text'] },
  ],
  openrouter: [
    { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini', capabilities: ['text', 'vision'] },
    { id: 'google/gemini-3.5-flash', label: 'Google Gemini 3.5 Flash', capabilities: ['text', 'vision'] },
  ],
}

export type ModelConfiguration = Record<ProviderName, { enabled: string[]; defaultModel: string }>

export const DEFAULT_MODEL_CONFIGURATION: ModelConfiguration = {
  gemini: { enabled: ['gemini-3.6-flash', 'gemini-3.5-flash'], defaultModel: 'gemini-3.6-flash' },
  groq: { enabled: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'], defaultModel: 'openai/gpt-oss-120b' },
  openrouter: { enabled: ['openai/gpt-4o-mini', 'google/gemini-3.6-flash'], defaultModel: 'openai/gpt-4o-mini' },
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
