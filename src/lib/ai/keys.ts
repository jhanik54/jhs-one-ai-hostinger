import type { ApiKeyEntry, ProviderName } from '@/types'

export function getAllKeys(): Record<ProviderName, ApiKeyEntry[]> {
  const keys: Record<ProviderName, ApiKeyEntry[]> = {
    gemini: [],
    groq: [],
    openrouter: [],
  }

  for (const [name, val] of Object.entries(process.env)) {
    const match = /^(GEMINI|GROQ|OPENROUTER)_KEY_(\d+)$/.exec(name)
    if (!match || !val?.trim()) continue
    const provider = match[1].toLowerCase() as 'gemini' | 'groq' | 'openrouter'
    keys[provider].push({ key: val.trim(), provider, index: Number(match[2]), used: 0, lastUsed: null, isActive: true })
  }

  return keys
}

const keyUsage = new Map<string, { count: number; lastError: Date | null; errorCount: number }>()
const keyLoad = new Map<string, number>()

export function acquireKey(keyId:string){keyLoad.set(keyId,(keyLoad.get(keyId)||0)+1);let released=false;return()=>{if(released)return;released=true;keyLoad.set(keyId,Math.max(0,(keyLoad.get(keyId)||1)-1))}}

export function recordKeyUsage(keyId: string, success: boolean, cooldownMs = 30000) {
  const current = keyUsage.get(keyId) ?? { count: 0, lastError: null as Date | null, errorCount: 0 }
  current.count++
  if (!success) {
    current.lastError = new Date(Date.now() + cooldownMs)
    current.errorCount++
  }
  keyUsage.set(keyId, current)
}

export function selectBestKey(keys: ApiKeyEntry[]): ApiKeyEntry | null {
  const activeKeys = keys.filter(k => k.isActive)

  if (activeKeys.length === 0) return null

  const scored = activeKeys.map(k => {
    const usage = keyUsage.get(`${k.provider}-${k.index}`)
    let score = 0

    score -= (keyLoad.get(`${k.provider}-${k.index}`) ?? 0) * 100000
    score -= (usage?.count ?? 0) * 10

    if (usage?.lastError) {
      const remaining = usage.lastError.getTime() - Date.now()
      if (remaining > 0) score -= 100000 + remaining
    }

    return { key: k, score }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored[0].key
}

export function getKeyStats() {
  const allKeys = getAllKeys()
  const stats: Record<string, { total: number; active: number; keys: {index:number;status:string}[] }> = {}

  for (const [provider, keys] of Object.entries(allKeys)) {
    stats[provider] = {
      total: keys.length,
      active: keys.filter(k => k.isActive).length,
      keys: keys.map(k => ({index:k.index,status:(keyUsage.get(`${provider}-${k.index}`)?.lastError?.getTime()||0)>Date.now()?'cooldown':'healthy'})),
    }
  }

  return stats
}
