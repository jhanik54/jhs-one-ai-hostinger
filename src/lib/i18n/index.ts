import { en } from './en'
import { bn } from './bn'

const translations = { en, bn } as const
type Lang = keyof typeof translations

let currentLang: Lang = 'en'

export function setLanguage(lang: 'en' | 'bn') {
  currentLang = lang
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'
  }
}

export function getCurrentLanguage(): Lang {
  return currentLang
}

export function t(path: string): string {
  const keys = path.split('.')
  const get = (source: unknown): unknown => keys.reduce<unknown>((value,key) => value && typeof value === 'object' && key in value ? (value as Record<string,unknown>)[key] : undefined, source)
  const value = get(translations[currentLang])
  if (typeof value === 'string') return value
  const fallback = get(translations.en)
  return typeof fallback === 'string' ? fallback : path
}

export { en, bn }
