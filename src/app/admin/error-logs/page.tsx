'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { formatDate } from '@/lib/utils/format'
import { AlertTriangle } from 'lucide-react'

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState<{id:string|number;provider:string;errorCode?:string|null;createdAt:string}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const response=await fetch('/api/admin/providers');const data=await response.json();setLogs((data.logs||[]).filter((x:{success:boolean})=>!x.success))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Error Logs</h2>
        <Badge variant="danger">{logs.length} errors</Badge>
      </div>

      <Card>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <AlertTriangle className="h-12 w-12 mb-3" />
            <p>No errors logged. All providers are healthy!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-500">Provider</th>
                  <th className="text-left py-3 px-4 text-gray-500">Error</th>
                  <th className="text-left py-3 px-4 text-gray-500">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="py-3 px-4">
                      <Badge variant="danger" className="capitalize">{log.provider}</Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400 max-w-md truncate">
                      {log.errorCode || 'Provider request failed'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
