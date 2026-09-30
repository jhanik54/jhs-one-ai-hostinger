import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const PLAN_IDS = ['NORMAL', 'STANDARD', 'PREMIUM', 'ULTRA'] as const
type PlanId = typeof PLAN_IDS[number]

export async function GET() {
  try {
    await requireAdmin()
    return NextResponse.json(await db.plan.findMany({ orderBy: { displayOrder: 'asc' } }))
  } catch {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await req.json() as Record<string, unknown> & { id?: string }
    if (!body.id || !PLAN_IDS.includes(body.id as PlanId)) return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    if (body.id === 'ULTRA' && body.active === true) return NextResponse.json({ error: 'Ultra is internal and cannot be made public.' }, { status: 400 })
    const data: {
      price?: number
      messageLimit?: number
      pdfLimit?: number
      imageLimit?: number
      active?: boolean
      description?: string | null
      features?: string[]
      displayOrder?: number
    } = {}
    if (body.price !== undefined) {
      if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > 1_000_000_000 || Math.abs(Math.round(body.price * 100) - body.price * 100) > 1e-8) return NextResponse.json({ error: 'Price must be a valid BDT amount with at most two decimal places.' }, { status: 400 })
      data.price = body.price
    }
    for (const key of ['messageLimit', 'pdfLimit', 'imageLimit'] as const) {
      const value = body[key]
      if (value === undefined) continue
      if (typeof value !== 'number' || !Number.isInteger(value) || value < (body.id === 'ULTRA' ? -1 : 0) || value > 1_000_000) return NextResponse.json({ error: `${key} must be a non-negative integer${body.id === 'ULTRA' ? ' or -1 for unlimited' : ''}.` }, { status: 400 })
      data[key] = value
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be true or false.' }, { status: 400 })
      data.active = body.id === 'ULTRA' ? false : body.active
    }
    if (body.description !== undefined) {
      if (body.description !== null && (typeof body.description !== 'string' || body.description.length > 5000)) return NextResponse.json({ error: 'Description must be no more than 5000 characters.' }, { status: 400 })
      data.description = body.description as string | null
    }
    if (body.features !== undefined) {
      if (!Array.isArray(body.features) || body.features.length > 30 || body.features.some(feature => typeof feature !== 'string' || !feature.trim() || feature.length > 200)) return NextResponse.json({ error: 'Features must be up to 30 non-empty strings, each no more than 200 characters.' }, { status: 400 })
      data.features = [...new Set((body.features as string[]).map(feature => feature.trim()))]
    }
    if (body.displayOrder !== undefined) {
      if (typeof body.displayOrder !== 'number' || !Number.isInteger(body.displayOrder) || body.displayOrder < 0 || body.displayOrder > 10000) return NextResponse.json({ error: 'displayOrder must be an integer from 0 to 10000.' }, { status: 400 })
      data.displayOrder = body.displayOrder
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: 'No supported changes provided.' }, { status: 400 })
    const plan = await db.plan.update({ where: { id: body.id }, data })
    await db.auditLog.create({ data: { actorId: admin.id, action: 'plan_configuration_changed', target: plan.id, metadata: data } })
    return NextResponse.json(plan)
  } catch {
    return NextResponse.json({ error: 'Unauthorized or unable to update plan.' }, { status: 403 })
  }
}
