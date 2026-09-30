import 'server-only'
import { cookies, headers } from 'next/headers'
import { createHmac, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

const COOKIE = 'jh_session'
const SESSION_DAYS = 30
function digest(token: string) { const secret=process.env.AUTH_SECRET;if(!secret||secret.length<32)throw new Error('AUTH_SECRET must be configured with at least 32 characters');return createHmac('sha256',secret).update(token).digest('hex') }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const h = await headers()
  await db.session.create({ data: { id: digest(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), userAgent: h.get('user-agent')?.slice(0, 512) } })
  const jar = await cookies()
  jar.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86400 })
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { id: digest(token) }, include: { user: { select: {id:true,email:true,name:true,image:true,status:true,mustChangePassword:true,profile:true,admin:true} } } }).catch(() => null)
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'active') return null
  return session.user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('UNAUTHORIZED')
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  if (!user.admin) throw new AuthError('FORBIDDEN')
  return user
}

export async function endSession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value
  if (token) await db.session.deleteMany({ where: { id: digest(token) } })
  jar.delete(COOKIE)
}

export async function hashPassword(password: string) { return bcrypt.hash(password, 12) }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash) }
export class AuthError extends Error { constructor(public code: 'UNAUTHORIZED' | 'FORBIDDEN') { super(code) } }
