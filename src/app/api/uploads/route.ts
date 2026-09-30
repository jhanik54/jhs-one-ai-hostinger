import { NextRequest, NextResponse } from 'next/server'
import { requireUser, AuthError } from '@/lib/auth'
import { db } from '@/lib/db'
import { MAX_REQUEST_BYTES, safeFilename, storePrivateFile, validateUpload, UploadValidationError, removePrivateFile } from '@/lib/uploads'
import { rateLimited } from '@/lib/rate-limit'
import { uploadQuotaWhere } from '@/lib/upload-policy'
import { maintenanceResponse } from '@/lib/maintenance'

export const runtime = 'nodejs'

async function getPlan(userId: string, admin: boolean) {
  const planId = admin ? 'ULTRA' : (await db.subscription.findFirst({ where: { userId, status: 'approved' }, orderBy: { updatedAt: 'desc' }, select: { planId: true } }))?.planId || 'NORMAL'
  return db.plan.findUnique({ where: { id: planId } })
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const unavailable = await maintenanceResponse(Boolean(user.admin))
    if (unavailable) return unavailable
    if (rateLimited(`upload:${user.id}`, 12, 60_000)) return NextResponse.json({ error: 'Please wait before uploading another file.' }, { status: 429 })
    const conversationId = req.nextUrl.searchParams.get('conversation_id')
    if (!conversationId) return NextResponse.json({ error: 'A conversation is required.' }, { status: 400 })
    const owner = await db.conversation.findFirst({ where: { id: conversationId, userId: user.id }, select: { id: true } })
    if (!owner) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    const files = await db.uploadedFile.findMany({ where: { conversationId, userId: user.id }, orderBy: { createdAt: 'asc' }, select: { id: true, filename: true, mimeType: true, size: true, type: true, createdAt: true } })
    return NextResponse.json(files.map(file => ({ ...file, size: Number(file.size) })))
  } catch (error) {
    return NextResponse.json({ error: error instanceof AuthError ? 'Sign in to continue.' : 'Unable to load files.' }, { status: error instanceof AuthError ? 401 : 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const unavailable = await maintenanceResponse(Boolean(user.admin))
    if (unavailable) return unavailable
    const length = Number(req.headers.get('content-length') || 0)
    if (length > MAX_REQUEST_BYTES) return NextResponse.json({ error: 'Upload request is too large.' }, { status: 413 })
    const contentType = req.headers.get('content-type')
    if (!contentType?.toLowerCase().startsWith('multipart/form-data;')) return NextResponse.json({ error: 'Use a multipart form to upload files.' }, { status: 415 })
    const reader = req.body?.getReader()
    if (!reader) return NextResponse.json({ error: 'Upload body is empty.' }, { status: 400 })
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_REQUEST_BYTES) { await reader.cancel(); return NextResponse.json({ error: 'Upload request is too large.' }, { status: 413 }) }
      chunks.push(value)
    }
    const boundedBody = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) { boundedBody.set(chunk, offset); offset += chunk.byteLength }
    const boundedRequest = new Request(req.url, { method: 'POST', headers: { 'content-type': contentType }, body: new Blob([boundedBody.buffer as ArrayBuffer]) })
    const form = await boundedRequest.formData()
    const conversationId = form.get('conversation_id')
    const entries = form.getAll('file')
    if (typeof conversationId !== 'string' || !conversationId || entries.length !== 1 || !(entries[0] instanceof File)) return NextResponse.json({ error: 'Choose one file and conversation.' }, { status: 400 })
    const file = entries[0]
    if (file.size > MAX_REQUEST_BYTES - 64 * 1024) return NextResponse.json({ error: 'Upload request is too large.' }, { status: 413 })
    for (const [key, value] of form.entries()) {
      if (key !== 'file' && key !== 'conversation_id') return NextResponse.json({ error: 'Unexpected upload fields.' }, { status: 400 })
      if (typeof value === 'string' && value.length > 256) return NextResponse.json({ error: 'Upload request is too large.' }, { status: 413 })
    }
    const owner = await db.conversation.findFirst({ where: { id: conversationId, userId: user.id }, select: { id: true } })
    if (!owner) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const { type, extension } = validateUpload(file.name, file.type, bytes)
    const plan = await getPlan(user.id, Boolean(user.admin))
    if (!plan) return NextResponse.json({ error: 'Your account plan is not configured.' }, { status: 503 })
    const field = type === 'pdf' ? 'pdfs' : 'images'
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    const storageKey = await storePrivateFile(bytes, extension)
    let record
    let currentPlanName = plan.name
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          record = await db.$transaction(async tx => {
        const currentPlan = await tx.plan.findUnique({ where: { id: plan.id }, select: { name: true, pdfLimit: true, imageLimit: true } })
        if (!currentPlan) throw new Error('UPLOAD_PLAN_MISSING')
        currentPlanName = currentPlan.name
        const currentLimit = type === 'pdf' ? currentPlan.pdfLimit : currentPlan.imageLimit
        await tx.usageCounter.upsert({ where: { userId_period_date: { userId: user.id, period: 'day', date: today } }, create: { userId: user.id, period: 'day', date: today }, update: {} })
        const result = await tx.usageCounter.updateMany({
          where: { userId: user.id, period: 'day', date: today, ...uploadQuotaWhere(field, currentLimit, Boolean(user.admin)) },
          data: { [field]: { increment: 1 } },
        })
        if (!result.count) throw new Error('UPLOAD_LIMIT_REACHED')
        return tx.uploadedFile.create({ data: { userId: user.id, conversationId, filename: safeFilename(file.name), mimeType: file.type.toLowerCase(), size: BigInt(bytes.length), type, storageKey }, select: { id: true, filename: true, mimeType: true, size: true, type: true, createdAt: true } })
          }, { isolationLevel: 'Serializable' })
          break
        } catch (error) {
          const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
          if (attempt < 3 && (code === 'P2034' || code === 'P2002')) continue
          throw error
        }
      }
    } catch (error) {
      await removePrivateFile(storageKey)
      if (error instanceof Error && error.message === 'UPLOAD_LIMIT_REACHED') return NextResponse.json({ error: `Your daily ${currentPlanName} ${type === 'pdf' ? 'PDF' : 'image'} upload limit has been reached.` }, { status: 429 })
      if (error instanceof Error && error.message === 'UPLOAD_PLAN_MISSING') return NextResponse.json({ error: 'Your account plan is not configured.' }, { status: 503 })
      throw error
    }
    await db.userActivityLog.create({ data: { userId: user.id, action: 'file_uploaded', metadata: { type, size: bytes.length } } }).catch(() => undefined)
    return NextResponse.json({ ...record, size: Number(record.size) }, { status: 201 })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.code === 'FORBIDDEN' ? 403 : 401 })
    if (error instanceof UploadValidationError) return NextResponse.json({ error: error.message }, { status: 415 })
    return NextResponse.json({ error: 'Unable to upload this file. Please try again.' }, { status: 500 })
  }
}
