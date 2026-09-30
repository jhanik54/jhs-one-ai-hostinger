import 'server-only'
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, realpath, writeFile, unlink, open } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
export { MAX_REQUEST_BYTES, safeFilename, validateUpload, UploadValidationError } from '@/lib/upload-validation'
export type { UploadType } from '@/lib/upload-validation'

function configuredRoot() {
  if (process.env.NODE_ENV === 'production' && !process.env.PRIVATE_UPLOAD_DIR) throw new Error('PRIVATE_UPLOAD_DIR must be configured in production')
  const root = path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(path.dirname(process.cwd()), 'jh-one-ai-private-uploads'))
  const publicRoot = path.resolve(process.cwd(), 'public')
  const webRootPath = root.split(path.sep).some(segment => ['public_html', 'htdocs', 'httpdocs'].includes(segment.toLowerCase()))
  if (webRootPath || root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) throw new Error('PRIVATE_UPLOAD_DIR must be outside the public web root')
  return root
}

async function ensureRoot() {
  const root = configuredRoot()
  await mkdir(root, { recursive: true, mode: 0o700 })
  const actual = await realpath(root)
  const publicRoot = await realpath(path.resolve(process.cwd(), 'public')).catch(() => path.resolve(process.cwd(), 'public'))
  const webRootPath = actual.split(path.sep).some(segment => ['public_html', 'htdocs', 'httpdocs'].includes(segment.toLowerCase()))
  if (webRootPath || actual === publicRoot || actual.startsWith(`${publicRoot}${path.sep}`)) throw new Error('Private upload directory resolves inside the public web root')
  await chmod(actual, 0o700)
  return actual
}

export async function storePrivateFile(bytes: Buffer, extension: string) {
  const root = await ensureRoot()
  const storageKey = `${randomUUID()}.${extension}`
  const target = path.join(root, storageKey)
  await writeFile(target, bytes, { flag: 'wx', mode: 0o600 })
  return storageKey
}

export async function readPrivateFile(storageKey: string) {
  if (!/^[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|webp|gif|avif)$/i.test(storageKey)) throw new Error('Invalid storage key')
  const root = await ensureRoot()
  const target = path.resolve(root, storageKey)
  if (path.dirname(target) !== root) throw new Error('Invalid storage path')
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW)
  try { return await handle.readFile() } finally { await handle.close() }
}

export async function removePrivateFile(storageKey: string) {
  if (!/^[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|webp|gif|avif)$/i.test(storageKey)) return
  const root = await ensureRoot()
  await unlink(path.join(root, storageKey)).catch(() => undefined)
}
