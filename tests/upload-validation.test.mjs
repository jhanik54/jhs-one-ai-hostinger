import assert from 'node:assert/strict'
import test from 'node:test'
import { validateUpload, UploadValidationError, MAX_PDF_BYTES, MAX_IMAGE_BYTES, safeFilename } from '../src/lib/upload-validation.ts'
import { uploadQuotaWhere, canDownloadUploadedFile, belongsToConversation } from '../src/lib/upload-policy.ts'

test('accepts a PDF only when extension, declared MIME, and signature agree', () => {
  assert.deepEqual(validateUpload('report.pdf', 'application/pdf', Buffer.from('%PDF-1.7 sample')), { type: 'pdf', extension: 'pdf' })
  assert.throws(() => validateUpload('report.exe', 'application/pdf', Buffer.from('%PDF-1.7')), UploadValidationError)
  assert.throws(() => validateUpload('report.pdf', 'application/pdf', Buffer.from('MZ executable')), UploadValidationError)
})

test('accepts supported raster image signatures and rejects MIME spoofing', () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(4), Buffer.from('IHDR'), Buffer.alloc(4)])
  assert.equal(validateUpload('photo.PNG', 'image/png', png).type, 'image')
  assert.throws(() => validateUpload('photo.png', 'image/png', Buffer.from('GIF89a')), UploadValidationError)
  assert.throws(() => validateUpload('photo.svg', 'image/svg+xml', Buffer.from('<svg/>')), UploadValidationError)
})

test('applies server-side file size limits and safe display names', () => {
  assert.throws(() => validateUpload('large.pdf', 'application/pdf', Buffer.alloc(MAX_PDF_BYTES + 1, 0)), UploadValidationError)
  assert.throws(() => validateUpload('large.jpg', 'image/jpeg', Buffer.alloc(MAX_IMAGE_BYTES + 1, 0)), UploadValidationError)
  assert.equal(safeFilename('../../report\u0000.pdf'), 'report.pdf')
})

test('builds a current-plan quota predicate and leaves admin Ultra uploads unlimited', () => {
  const normalPdf = uploadQuotaWhere('pdfs', 2, false)
  const premiumImage = uploadQuotaWhere('images', 15, false)
  assert.deepEqual(normalPdf, { pdfs: { lt: 2 } })
  assert.deepEqual(premiumImage, { images: { lt: 15 } })
  assert.deepEqual(uploadQuotaWhere('pdfs', -1, false), { pdfs: { lt: 0 } })
  assert.deepEqual(uploadQuotaWhere('images', -1, true), {})
})

test('restricts download and chat attachment access to the owner or an admin in the same conversation', () => {
  assert.equal(canDownloadUploadedFile('user-a', false, 'user-a'), true)
  assert.equal(canDownloadUploadedFile('user-b', false, 'user-a'), false)
  assert.equal(canDownloadUploadedFile('admin', true, 'user-a'), true)
  assert.equal(belongsToConversation({ userId: 'user-a', conversationId: 'chat-a' }, 'user-a', 'chat-a'), true)
  assert.equal(belongsToConversation({ userId: 'user-a', conversationId: 'chat-b' }, 'user-a', 'chat-a'), false)
  assert.equal(belongsToConversation({ userId: 'user-b', conversationId: 'chat-a' }, 'user-a', 'chat-a'), false)
})
