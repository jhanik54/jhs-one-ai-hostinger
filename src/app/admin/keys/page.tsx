'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Key, CheckCircle, XCircle } from 'lucide-react'

export default function AdminKeysPage() {
  const [data, setData] = useState<{key_stats?:Record<string,{total:number;active:number;keys:{index:number;status:string}[]}>} | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/providers')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  const providers = ['gemini', 'groq', 'openrouter']

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Keys</h2>
      <p className="text-sm text-gray-500">Configured key counts reflect server environment variables.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {providers.map(provider => {
          const stats = data?.key_stats?.[provider] || { total: 0, active: 0, keys: [] }
          return (
            <Card key={provider}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{provider}</h3>
                </div>
                <Badge variant={stats.active === stats.total ? 'success' : 'warning'}>
                  {stats.active}/{stats.total} Active
                </Badge>
              </div>
              <div className="space-y-1.5">
                {stats.keys.map(({index,status}) => {
                  const isActive = status === 'healthy'
                  return (
                    <div key={index} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        {isActive ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-400" />
                        )}
                        <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                          {provider.toUpperCase()} KEY #{index}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 capitalize">{status}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
