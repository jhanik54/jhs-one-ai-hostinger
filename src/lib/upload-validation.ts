import path from 'node:path'

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_REQUEST_BYTES = 11 * 1024 * 1024
export type UploadType = 'pdf' | 'image'

const allowed: Record<UploadType, Map<string, readonly string[]>> = {
  pdf: new Map([['application/pdf', ['pdf']]]),
  image: new Map([
    ['image/jpeg', ['jpg', 'jpeg']], ['image/png', ['png']], ['image/webp', ['webp']],
    ['image/gif', ['gif']], ['image/avif', ['avif']],
  ]),
}

export function safeFilename(name: string) {
  const base = path.basename(name.replace(/\\/g, '/')).normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\p{L}\p{N}._ ()-]/gu, '_').trim()
  return (base || 'upload').slice(0, 255)
}

export function validateUpload(name: string, mimeType: string, bytes: Buffer): { type: UploadType; extension: string } {
  const extension = path.extname(name).slice(1).toLowerCase()
  const normalizedMime = mimeType.toLowerCase()
  const type: UploadType = normalizedMime === 'application/pdf' ? 'pdf' : 'image'
  const allowedExtensions = allowed[type].get(normalizedMime)
  if (!allowedExtensions || !allowedExtensions.includes(extension)) throw new UploadValidationError('This file type is not supported.')
  const max = type === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES
  if (!bytes.length || bytes.length > max) throw new UploadValidationError(type === 'pdf' ? 'PDF files must be 10 MB or smaller.' : 'Images must be 8 MB or smaller.')

  const valid = type === 'pdf'
    ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
    : (normalizedMime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || (normalizedMime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii', 12, 16) === 'IHDR')
      || (normalizedMime === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
      || (normalizedMime === 'image/gif' && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)))
      || (normalizedMime === 'image/avif' && bytes.toString('ascii', 4, 12) === 'ftypavif')
  if (!valid) throw new UploadValidationError('The file contents do not match the selected file type.')
  return { type, extension }
}

export class UploadValidationError extends Error {}
