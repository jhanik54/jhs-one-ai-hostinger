'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Users, MessageSquare, MessagesSquare, Activity } from 'lucide-react'
import type { DashboardStats } from '@/types'

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async r => r.ok ? r.json() : null)
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Total Messages', value: stats?.total_messages ?? 0, icon: MessageSquare, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Conversations', value: stats?.total_conversations ?? 0, icon: MessagesSquare, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: 'Active Today', value: stats?.active_today ?? 0, icon: Activity, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}><Skeleton className="h-24" /></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h2>
        <Badge variant={stats?.database === 'connected' ? 'success' : 'danger'}>{stats?.database === 'connected' ? 'MySQL connected' : 'System status unavailable'}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <Card key={i}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{card.value.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Plan distribution</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(['NORMAL', 'STANDARD', 'PREMIUM', 'ULTRA'] as const).map(plan => <div key={plan} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900"><p className="text-gray-500">{plan}</p><p className="text-xl font-semibold">{stats?.plan_distribution?.[plan] ?? 0}</p></div>)}
          </div>
          <p className="mt-3 text-sm text-gray-500">Pending subscription requests: {stats?.pending_subscriptions ?? 0}</p>
        </Card>
        <Card>
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Provider activity today</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-gray-500">Requests</p><p className="text-xl font-semibold">{stats?.provider_metrics?.requests_today ?? 0}</p></div>
            <div><p className="text-gray-500">Successful</p><p className="text-xl font-semibold">{stats?.provider_metrics?.successes_today ?? 0}</p></div>
            <div><p className="text-gray-500">Failed</p><p className="text-xl font-semibold">{stats?.provider_metrics?.failures_today ?? 0}</p></div>
            <div><p className="text-gray-500">Success rate</p><p className="text-xl font-semibold">{stats?.provider_metrics?.requests_today ? `${Math.round((stats.provider_metrics.successes_today / stats.provider_metrics.requests_today) * 100)}%` : '—'}</p></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your AI providers, monitor API keys, and view error logs from the sidebar.
            </p>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">System Info</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Company</span>
              <span className="text-gray-900 dark:text-gray-100">JH Soft Corporation</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Product</span>
              <span className="text-gray-900 dark:text-gray-100">JH One AI</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Active AI Providers</span><span className="text-gray-900 dark:text-gray-100">{stats?.provider_metrics?.active_providers ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Configured API Keys</span><span className="text-gray-900 dark:text-gray-100">{stats?.provider_metrics?.configured_keys ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Messages this month</span><span className="text-gray-900 dark:text-gray-100">{stats?.messages_month ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">PDFs / images today</span><span className="text-gray-900 dark:text-gray-100">{stats?.uploads_today?.pdfs ?? 0} / {stats?.uploads_today?.images ?? 0}</span></div>
          </div>
        </Card>
      </div>
    </div>
  )
}
