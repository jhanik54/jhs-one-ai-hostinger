import { NextResponse } from 'next/server'
import { endSession, getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
export async function POST() { const user = await getCurrentUser(); await endSession(); if (user) await db.userActivityLog.create({ data: { userId: user.id, action: 'logout' } }).catch(() => undefined); return NextResponse.json({ success: true }) }
