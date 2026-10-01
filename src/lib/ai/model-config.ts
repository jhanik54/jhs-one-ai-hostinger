import 'server-only'
import { db } from '@/lib/db'
import { DEFAULT_MODEL_CONFIGURATION, validateModelConfiguration } from './model-catalog'
import type { ModelConfiguration } from './model-catalog'

export { AVAILABLE_MODELS, DEFAULT_MODEL_CONFIGURATION, validateModelConfiguration } from './model-catalog'
export type { ModelConfiguration } from './model-catalog'

export async function getModelConfiguration(): Promise<ModelConfiguration> {
  const row = await db.appSetting.findUnique({ where: { key: 'model_configuration' }, select: { value: true } })
  if (!row) return DEFAULT_MODEL_CONFIGURATION
  const configuration = validateModelConfiguration(row.value)
  if (!configuration) {
    console.warn('[ai-gateway] saved model configuration is invalid for the current catalog; defaults are active')
    return DEFAULT_MODEL_CONFIGURATION
  }
  return configuration
}
