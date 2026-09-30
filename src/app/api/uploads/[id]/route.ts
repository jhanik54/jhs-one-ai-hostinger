import { NextResponse } from 'next/server'
import { requireUser, AuthError } from '@/lib/auth'
import { db } from '@/lib/db'
import { readPrivateFile } from '@/lib/uploads'
import { canDownloadUploadedFile } from '@/lib/upload-policy'

export const runtime = 'nodejs'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await context.params
    const file = await db.uploadedFile.findUnique({ where: { id } })
    if (!file || !canDownloadUploadedFile(user.id, Boolean(user.admin), file.userId)) return NextResponse.json({ error: 'File not found.' }, { status: 404 })
    const bytes = await readPrivateFile(file.storageKey)
    const disposition = file.type === 'image' ? 'inline' : 'attachment'
    const encodedName = encodeURIComponent(file.filename).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store, max-age=0',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    })
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: 'Sign in to continue.' }, { status: error.code === 'FORBIDDEN' ? 403 : 401 })
    return NextResponse.json({ error: 'Unable to retrieve this file.' }, { status: 500 })
  }
}
