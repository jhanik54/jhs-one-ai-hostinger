import 'server-only'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { shouldBlockForMaintenance } from '@/lib/maintenance-policy'

export async function maintenanceResponse(isAdmin: boolean) {
  if (isAdmin) return null
  const setting = await db.appSetting.findUnique({ where: { key: 'maintenance_mode' }, select: { value: true } })
  if (!shouldBlockForMaintenance(isAdmin, setting?.value)) return null
  return NextResponse.json({ error: 'JH One AI is temporarily under maintenance. Please try again later.', code: 'MAINTENANCE' }, { status: 503, headers: { 'Retry-After': '300' } })
}
