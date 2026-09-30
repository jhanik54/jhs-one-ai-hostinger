import 'server-only'
import { db } from '@/lib/db'
import { DEFAULT_MODEL_CONFIGURATION, validateModelConfiguration } from './model-catalog'
import type { ModelConfiguration } from './model-catalog'

export { AVAILABLE_MODELS, DEFAULT_MODEL_CONFIGURATION, validateModelConfiguration } from './model-catalog'
export type { ModelConfiguration } from './model-catalog'

export async function getModelConfiguration(): Promise<ModelConfiguration> {
  const row = await db.appSetting.findUnique({ where: { key: 'model_configuration' }, select: { value: true } })
  return validateModelConfiguration(row?.value) ?? DEFAULT_MODEL_CONFIGURATION
}
