import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldBlockForMaintenance } from '../src/lib/maintenance-policy.ts'

test('maintenance blocks regular users and leaves admins operational', () => {
  assert.equal(shouldBlockForMaintenance(false, true), true)
  assert.equal(shouldBlockForMaintenance(true, true), false)
  assert.equal(shouldBlockForMaintenance(false, false), false)
  assert.equal(shouldBlockForMaintenance(false, 'true'), false)
})
