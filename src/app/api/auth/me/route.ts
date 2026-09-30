import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  const planId = user.admin
    ? 'ULTRA'
    : (await db.subscription.findFirst({
        where: { userId: user.id, status: 'approved' },
        orderBy: { updatedAt: 'desc' },
        select: { planId: true },
      }))?.planId || 'NORMAL'
  return NextResponse.json({ id: user.id, email: user.email, name: user.name, image: user.image, admin: !!user.admin, plan: planId })
}
