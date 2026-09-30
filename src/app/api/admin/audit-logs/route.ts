import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

function readDate(value: string | null, end = false) {
  if (!value) return undefined
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const p = req.nextUrl.searchParams
    const page = Math.max(1, Math.min(100000, Number(p.get('page')) || 1))
    const pageSize = Math.max(1, Math.min(100, Number(p.get('pageSize')) || 25))
    const q = (p.get('q') || '').trim().slice(0, 160)
    const action = (p.get('action') || '').trim().slice(0, 100)
    const from = readDate(p.get('from'))
    const to = readDate(p.get('to'), true)
    if (from === null || to === null) return NextResponse.json({ error: 'Use valid YYYY-MM-DD dates.' }, { status: 400 })
    const actorIds = q ? (await db.user.findMany({ where: { OR: [{ email: { contains: q } }, { name: { contains: q } }, { id: { contains: q } }] }, select: { id: true }, take: 100 })).map(user => user.id) : []
    const filters: Prisma.AuditLogWhereInput[] = []
    if (action) filters.push({ action: { contains: action } })
    if (from || to) filters.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } })
    if (q) filters.push({ OR: [{ action: { contains: q } }, { target: { contains: q } }, ...(actorIds.length ? [{ actorId: { in: actorIds } }] : [])] })
    const where: Prisma.AuditLogWhereInput = filters.length ? { AND: filters } : {}
    const [total, rows] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize })])
    const actorIdsOnPage = [...new Set(rows.map(row => row.actorId).filter((id): id is string => !!id))]
    const actors = actorIdsOnPage.length ? await db.user.findMany({ where: { id: { in: actorIdsOnPage } }, select: { id: true, email: true } }) : []
    const emailById = new Map(actors.map(actor => [actor.id, actor.email]))
    return NextResponse.json({ total, page, pageSize, items: rows.map(row => ({ id: row.id.toString(), actorId: row.actorId, actorEmail: row.actorId ? emailById.get(row.actorId) || null : null, action: row.action, target: row.target, metadata: row.metadata, createdAt: row.createdAt })) })
  } catch {
    return NextResponse.json({ error: 'Unauthorized or unable to load audit logs.' }, { status: 403 })
  }
}
