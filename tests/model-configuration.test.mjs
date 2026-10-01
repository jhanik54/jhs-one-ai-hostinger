import test from 'node:test'
import assert from 'node:assert/strict'
import { AVAILABLE_MODELS, DEFAULT_MODEL_CONFIGURATION, validateModelConfiguration } from '../src/lib/ai/model-catalog.ts'

test('default provider model configuration only uses registered models', () => {
  assert.deepEqual(validateModelConfiguration(DEFAULT_MODEL_CONFIGURATION), DEFAULT_MODEL_CONFIGURATION)
  for (const [provider, config] of Object.entries(DEFAULT_MODEL_CONFIGURATION)) {
    const ids = AVAILABLE_MODELS[provider].map(model => model.id)
    assert.ok(ids.includes(config.defaultModel))
    assert.ok(config.enabled.every(model => ids.includes(model)))
  }
})

test('model configuration rejects unknown, empty, or disabled defaults', () => {
  const unknown = structuredClone(DEFAULT_MODEL_CONFIGURATION)
  unknown.groq.enabled = ['arbitrary-model']
  assert.equal(validateModelConfiguration(unknown), null)

  const empty = structuredClone(DEFAULT_MODEL_CONFIGURATION)
  empty.gemini.enabled = []
  assert.equal(validateModelConfiguration(empty), null)

  const disabledDefault = structuredClone(DEFAULT_MODEL_CONFIGURATION)
  disabledDefault.openrouter.enabled = ['google/gemini-3.5-flash']
  assert.equal(validateModelConfiguration(disabledDefault), null)
})

test('duplicate model ids are deduplicated in valid configuration', () => {
  const duplicated = structuredClone(DEFAULT_MODEL_CONFIGURATION)
  duplicated.gemini.enabled = ['gemini-3.5-flash', 'gemini-3.5-flash']
  assert.deepEqual(validateModelConfiguration(duplicated).gemini.enabled, ['gemini-3.5-flash'])
})
