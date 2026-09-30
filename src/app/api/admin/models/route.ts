import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { AVAILABLE_MODELS, getModelConfiguration, validateModelConfiguration } from '@/lib/ai/model-config'

export async function GET() {
  try {
    await requireAdmin()
    const configuration = await getModelConfiguration()
    return NextResponse.json({ available: AVAILABLE_MODELS, configuration })
  } catch {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await req.json() as { configuration?: unknown }
    const configuration = validateModelConfiguration(body.configuration)
    if (!configuration) return NextResponse.json({ error: 'Each provider needs one or more available models enabled, with its default selected from that enabled list.' }, { status: 400 })
    const old = await getModelConfiguration()
    await db.$transaction(async tx => {
      await tx.appSetting.upsert({ where: { key: 'model_configuration' }, create: { key: 'model_configuration', value: configuration }, update: { value: configuration } })
      await tx.auditLog.create({ data: { actorId: admin.id, action: 'model_configuration_changed', target: 'model_configuration', metadata: { before: old, after: configuration } } })
    })
    return NextResponse.json({ success: true, configuration })
  } catch {
    return NextResponse.json({ error: 'Unable to save model configuration.' }, { status: 403 })
  }
}
