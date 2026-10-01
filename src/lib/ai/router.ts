import 'server-only'
import type { ProviderName } from '@/types'
import { db } from '@/lib/db'
import { getAllKeys, selectBestKey, recordKeyUsage, acquireKey } from './keys'
import { callGemini } from './providers/gemini'
import { callGroq } from './providers/groq'
import { callOpenRouter } from './providers/openrouter'
import { getModelConfiguration } from './model-config'
import { AVAILABLE_MODELS } from './model-catalog'

type History = { role: 'user' | 'assistant'; content: string }[]
type ImageAttachment = { mimeType: string; data: string }
type Provider = 'gemini' | 'groq' | 'openrouter'

const callbacks: Record<Provider, (key: string, msg: string, history: History, images: ImageAttachment[], model: string) => Promise<ReadableStream<Uint8Array>>> = {
  gemini: (key, msg, history, images, model) => callGemini(key, msg, history, images, model),
  groq: (key, msg, history, _images, model) => callGroq(key, msg, history, model),
  openrouter: (key, msg, history, images, model) => callOpenRouter(key, msg, history, images, model),
}

const failures = new Map<string, { count: number; until: number }>()
const modelRotation = new Map<string, number>()
const defaults: Record<Provider, number> = { gemini: 40, groq: 30, openrouter: 30 }

function weightedOrder(providers: Provider[], weights: Record<string, number>) {
  const remaining = [...providers]
  const out: Provider[] = []
  while (remaining.length) {
    const total = remaining.reduce((n, provider) => n + Math.max(0, weights[provider] ?? 0), 0)
    if (!total) {
      out.push(...remaining)
      break
    }
    let roll = Math.random() * total
    let chosen = remaining[0]
    for (const provider of remaining) {
      roll -= Math.max(0, weights[provider] ?? 0)
      if (roll <= 0) {
        chosen = provider
        break
      }
    }
    out.push(chosen)
    remaining.splice(remaining.indexOf(chosen), 1)
  }
  return out
}

function selectConfiguredModel(provider: Provider, enabled: string[], preferred: string, hasImages: boolean) {
  const supported = enabled.filter(model =>
    !hasImages || AVAILABLE_MODELS[provider].find(item => item.id === model)?.capabilities.includes('vision'),
  )
  if (!supported.length) return null
  const ordered = [
    ...(supported.includes(preferred) ? [preferred] : []),
    ...supported.filter(model => model !== preferred),
  ]
  const cursor = modelRotation.get(provider) || 0
  modelRotation.set(provider, (cursor + 1) % ordered.length)
  return ordered[cursor % ordered.length]
}

function providerErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return {}
  const value = error as { name?: unknown; status?: unknown }
  const status = Number(value.status)
  return {
    ...(typeof value.name === 'string' ? { errorName: value.name.slice(0, 80) } : {}),
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { httpStatus: status } : {}),
  }
}

async function waitForFirstChunk(stream: ReadableStream<Uint8Array>, timeoutMs: number) {
  const reader = stream.getReader()
  let timer: ReturnType<typeof setTimeout> | undefined
  const firstRead = reader.read()
  try {
    const first = await Promise.race([
      firstRead,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Provider timed out before first chunk')), timeoutMs)
      }),
    ])
    if (first.done) throw new Error('Provider closed the stream before the first chunk')

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(first.value)
          while (true) {
            const item = await reader.read()
            if (item.done) break
            controller.enqueue(item.value)
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        } finally {
          reader.releaseLock()
        }
      },
      async cancel(reason) {
        await reader.cancel(reason).catch(() => undefined)
      },
    })
  } catch (error) {
    void reader.cancel(error).catch(() => undefined)
    void firstRead.catch(() => undefined).then(() => reader.releaseLock()).catch(() => undefined)
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function routeAIRequest(
  message: string,
  history: History,
  configured?: ProviderName[],
  userId?: string,
  images: ImageAttachment[] = [],
): Promise<{ stream: ReadableStream<Uint8Array>; usedProvider: ProviderName; keyIndex: number; release: () => void }> {
  const [activeRow, weightRow, modelConfiguration] = await Promise.all([
    db.appSetting.findUnique({ where: { key: 'active_providers' } }),
    db.appSetting.findUnique({ where: { key: 'provider_weights' } }),
    getModelConfiguration(),
  ])
  const valid = ['gemini', 'groq', 'openrouter'] as const
  const setting = Array.isArray(activeRow?.value)
    ? activeRow.value.filter((item): item is Provider => valid.includes(item as Provider))
    : valid
  const providers = (configured || setting).filter((provider): provider is Provider =>
    valid.includes(provider as Provider) &&
    modelConfiguration[provider as Provider].enabled.some(model =>
      !images.length || AVAILABLE_MODELS[provider as Provider].find(item => item.id === model)?.capabilities.includes('vision'),
    ),
  )
  const weights = {
    ...defaults,
    ...(weightRow?.value && typeof weightRow.value === 'object' ? weightRow.value as Record<string, number> : {}),
  }
  const ordered = weightedOrder([...new Set(providers)], weights)
  const allKeys = getAllKeys()
  const keyCounts = Object.fromEntries(valid.map(provider => [provider, allKeys[provider].length]))
  let lastError: unknown
  let attempts = 0

  for (const provider of ordered) {
    const circuit = failures.get(provider)
    if (circuit && circuit.until > Date.now()) {
      console.warn('[ai-gateway] provider circuit is open', JSON.stringify({ provider, retryAfterMs: circuit.until - Date.now() }))
      continue
    }

    const model = selectConfiguredModel(
      provider,
      modelConfiguration[provider].enabled,
      modelConfiguration[provider].defaultModel,
      images.length > 0,
    )
    if (!model) {
      console.error('[ai-gateway] provider has no enabled model for this request', JSON.stringify({ provider, hasImages: images.length > 0 }))
      continue
    }

    const keyStats = await db.providerKeyStat.findMany({
      where: { provider },
      select: { keyIndex: true, status: true, cooldownUntil: true },
    })
    const statusByIndex = new Map(keyStats.map(item => [item.keyIndex, item]))
    const now = new Date()
    const available = allKeys[provider].filter(key => {
      const status = statusByIndex.get(key.index)
      // Runtime disabled states represent invalid-key failures and have a cooldown;
      // retry when it expires so corrected Hostinger env vars can recover without DB edits.
      return !status?.cooldownUntil || status.cooldownUntil <= now
    })
    if (!available.length) {
      const persistedStatuses = keyStats.reduce((counts, item) => {
        counts[item.status] = (counts[item.status] || 0) + 1
        return counts
      }, {} as Record<string, number>)
      console.warn('[ai-gateway] provider has no eligible keys', JSON.stringify({
        provider,
        configuredKeyCount: allKeys[provider].length,
        persistedStatuses,
      }))
    }

    while (available.length) {
      const key = selectBestKey(available)
      if (!key) break
      available.splice(available.indexOf(key), 1)
      const release = acquireKey(`${provider}-${key.index}`)
      const started = Date.now()
      attempts++

      try {
        let timer: ReturnType<typeof setTimeout> | undefined
        const stream = await Promise.race([
          callbacks[provider](key.key, message, history, images, model),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Provider request timed out')), 20000)
          }),
        ]).finally(() => {
          if (timer) clearTimeout(timer)
        })
        const readyStream = await waitForFirstChunk(stream, 20000)
        recordKeyUsage(`${provider}-${key.index}`, true)
        failures.delete(provider)
        await db.providerKeyStat.upsert({
          where: { provider_keyIndex: { provider, keyIndex: key.index } },
          create: { id: `${provider}:${key.index}`, provider, keyIndex: key.index, status: 'healthy', successCount: 1 },
          update: {
            status: 'healthy',
            successCount: { increment: 1 },
            lastUsed: new Date(),
            lastSuccess: new Date(),
            cooldownUntil: null,
          },
        }).catch(() => undefined)
        console.info('[ai-gateway] provider ready', JSON.stringify({ provider, model, keyIndex: key.index }))
        return { stream: readyStream, usedProvider: provider, keyIndex: key.index, release }
      } catch (error) {
        release()
        lastError = error
        const status = Number(providerErrorDetails(error).httpStatus) || 0
        const cooldownMs = status === 429 ? 60000 : 30000
        recordKeyUsage(`${provider}-${key.index}`, false, cooldownMs)
        console.error('[ai-gateway] provider attempt failed', JSON.stringify({
          provider,
          model,
          keyIndex: key.index,
          ...providerErrorDetails(error),
        }))
        await db.providerLog.create({
          data: {
            provider,
            keyIndex: key.index,
            userId,
            success: false,
            responseTimeMs: Date.now() - started,
            statusCode: status || null,
            errorCode: status === 429 ? 'RATE_LIMIT' : status === 401 || status === 403 ? 'INVALID_KEY' : 'PROVIDER_FAILURE',
          },
        }).catch(() => undefined)
        await db.providerKeyStat.upsert({
          where: { provider_keyIndex: { provider, keyIndex: key.index } },
          create: {
            id: `${provider}:${key.index}`,
            provider,
            keyIndex: key.index,
            status: status === 401 || status === 403 ? 'disabled' : 'cooldown',
            failureCount: 1,
            cooldownUntil: new Date(Date.now() + cooldownMs),
          },
          update: {
            status: status === 401 || status === 403 ? 'disabled' : 'cooldown',
            failureCount: { increment: 1 },
            lastUsed: new Date(),
            lastFailure: new Date(),
            cooldownUntil: new Date(Date.now() + cooldownMs),
          },
        }).catch(() => undefined)
        const previous = failures.get(provider) || { count: 0, until: 0 }
        previous.count++
        if (previous.count >= 3) {
          previous.until = Date.now() + 60000
          previous.count = 0
        }
        failures.set(provider, previous)
      }
    }
  }

  console.error('[ai-gateway] request exhausted', JSON.stringify({
    activeProviders: setting,
    eligibleProviders: ordered,
    enabledModels: Object.fromEntries(valid.map(provider => [provider, modelConfiguration[provider].enabled])),
    configuredKeyCounts: keyCounts,
    attemptedKeys: attempts,
    ...providerErrorDetails(lastError),
  }))
  throw lastError ?? new Error('No AI providers are currently available')
}

export function getActiveProviders(): ProviderName[] {
  return ['gemini', 'groq', 'openrouter']
}
