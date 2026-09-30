import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAllKeys } from '@/lib/ai/keys'

export async function GET() {
  try {
    await requireAdmin()
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const [totalUsers, totalMessages, totalConversations, messagesToday, messagesMonth, usersToday, activeRows, pendingSubscriptions, pdfsToday, imagesToday, providerLogs, providerSetting, plans, ultraUsers] = await Promise.all([
      db.user.count(),
      db.message.count(),
      db.conversation.count(),
      db.message.count({ where: { role: 'user', createdAt: { gte: today } } }),
      db.message.count({ where: { role: 'user', createdAt: { gte: month } } }),
      db.user.count({ where: { createdAt: { gte: today } } }),
      db.userActivityLog.findMany({ where: { createdAt: { gte: today }, userId: { not: null } }, select: { userId: true }, distinct: ['userId'] }),
      db.subscription.count({ where: { status: 'pending' } }),
      db.uploadedFile.count({ where: { type: 'pdf', createdAt: { gte: today } } }),
      db.uploadedFile.count({ where: { type: 'image', createdAt: { gte: today } } }),
      db.providerLog.groupBy({ by: ['success'], _count: { _all: true }, where: { createdAt: { gte: today } } }),
      db.appSetting.findUnique({ where: { key: 'active_providers' }, select: { value: true } }),
      db.subscription.findMany({ where: { status: 'approved' }, select: { planId: true } }),
      db.adminUser.count(),
    ])
    const active = Array.isArray(providerSetting?.value) ? providerSetting.value.length : 3
    const keyPools = getAllKeys()
    const configuredKeys = Object.values(keyPools).reduce((sum, keys) => sum + keys.length, 0)
    const providerSuccess = providerLogs.find(row => row.success)?._count._all ?? 0
    const providerFailure = providerLogs.find(row => !row.success)?._count._all ?? 0
    const distribution: Record<string, number> = { NORMAL: Math.max(0, totalUsers - ultraUsers - plans.length), STANDARD: 0, PREMIUM: 0, ULTRA: ultraUsers }
    for (const subscription of plans) if (subscription.planId in distribution) distribution[subscription.planId]++
    return NextResponse.json({
      total_users: totalUsers,
      total_messages: totalMessages,
      total_conversations: totalConversations,
      messages_today: messagesToday,
      messages_month: messagesMonth,
      users_today: usersToday,
      active_today: activeRows.length,
      pending_subscriptions: pendingSubscriptions,
      uploads_today: { pdfs: pdfsToday, images: imagesToday },
      plan_distribution: distribution,
      provider_metrics: { active_providers: active, configured_keys: configuredKeys, requests_today: providerSuccess + providerFailure, successes_today: providerSuccess, failures_today: providerFailure },
      database: 'connected',
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized or database unavailable.' }, { status: 403 })
  }
}
