import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, hashPassword } from '@/lib/auth'
import { rateLimited } from '@/lib/rate-limit'
import { maintenanceResponse } from '@/lib/maintenance'
export async function POST(req: NextRequest) {
  try {
    const unavailable = await maintenanceResponse(false)
    if (unavailable) return unavailable
    const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
    if(rateLimited(`register:${address}`,8,60*60_000))return NextResponse.json({error:'Too many registration attempts. Please try again later.'},{status:429})
    const registrationSetting=await db.appSetting.findUnique({where:{key:'registrations_enabled'}})
    if (process.env.DISABLE_REGISTRATION === 'true'||registrationSetting?.value===false) return NextResponse.json({ error: 'Registration is temporarily disabled.' }, { status: 403 })
    const { email, password, name } = await req.json()
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 10 || password.length > 128) return NextResponse.json({ error: 'Enter a valid email and a password of at least 10 characters.' }, { status: 400 })
    const id = crypto.randomUUID().replaceAll('-', '').slice(0, 30)
    const user = await db.user.create({ data: { id, email: email.trim().toLowerCase(), passwordHash: await hashPassword(password), name: typeof name === 'string' ? name.slice(0, 160) : null, profile: { create: { displayName: typeof name === 'string' ? name.slice(0,160) : null } } } })
    await db.userActivityLog.create({ data: { userId: user.id, action: 'registration' } })
    await createSession(user.id)
    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
  } catch (e) { if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 }); return NextResponse.json({ error: 'Unable to create account.' }, { status: 500 }) }
}
