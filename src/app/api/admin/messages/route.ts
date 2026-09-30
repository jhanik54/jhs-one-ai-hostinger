import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

function dateValue(raw: string | null, end = false) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined
  const date = new Date(`${raw}T${end ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw ? undefined : date
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const params = req.nextUrl.searchParams
    const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1))
    const pageSize = Math.max(1, Math.min(100, Number(params.get('pageSize')) || 25))
    const q = (params.get('q') || '').trim().slice(0, 160)
    const userId = (params.get('userId') || '').slice(0, 30)
    const conversationId = (params.get('conversationId') || '').slice(0, 30)
    const role = params.get('role')
    const from = dateValue(params.get('from'))
    const to = dateValue(params.get('to'), true)
    if (role && role !== 'user' && role !== 'assistant') return NextResponse.json({ error: 'Invalid message role.' }, { status: 400 })
    if (params.has('from') && !from || params.has('to') && !to) return NextResponse.json({ error: 'Use valid YYYY-MM-DD dates.' }, { status: 400 })
    const userIds = userId ? [userId] : q ? (await db.user.findMany({ where: { OR: [{ email: { contains: q } }, { name: { contains: q } }] }, select: { id: true }, take: 100 })).map(user => user.id) : []
    const filters: Prisma.MessageWhereInput[] = []
    if (role) filters.push({ role })
    if (conversationId) filters.push({ conversationId })
    if (userId) filters.push({ conversation: { userId } })
    if (from || to) filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
    if (q) filters.push({ OR: [{ content: { contains: q } }, { conversationId: { contains: q } }, ...(userIds.length ? [{ conversation: { userId: { in: userIds } } }] : [])] })
    const where: Prisma.MessageWhereInput = filters.length ? { AND: filters } : {}
    const [total, rows, today] = await Promise.all([
      db.message.count({ where }),
      db.message.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, role: true, content: true, createdAt: true, conversationId: true, conversation: { select: { userId: true, title: true, user: { select: { email: true } } } } } }),
      db.message.count({ where: { createdAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } } }),
    ])
    return NextResponse.json({ total, today, page, pageSize, items: rows.map(row => ({ id: row.id.toString(), role: row.role, excerpt: row.content.slice(0, 600), createdAt: row.createdAt, conversationId: row.conversationId, conversationTitle: row.conversation.title, userId: row.conversation.userId, userEmail: row.conversation.user.email })) })
  } catch {
    return NextResponse.json({ error: 'Unauthorized or unable to load messages.' }, { status: 403 })
  }
}
