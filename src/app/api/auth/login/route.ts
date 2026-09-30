import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, verifyPassword } from '@/lib/auth'
import { rateLimited } from '@/lib/rate-limit'
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (typeof email !== 'string' || typeof password !== 'string') return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
    if(rateLimited(`login:${address}:${email.toLowerCase()}`,8,15*60_000))return NextResponse.json({error:'Too many sign-in attempts. Please wait and try again.'},{status:429})
    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!user?.passwordHash || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 })
    await createSession(user.id); await db.userActivityLog.create({ data: { userId: user.id, action: 'login' } })
    return NextResponse.json({ id: user.id, email: user.email, name: user.name })
  } catch { return NextResponse.json({ error: 'Unable to sign in.' }, { status: 500 }) }
}
