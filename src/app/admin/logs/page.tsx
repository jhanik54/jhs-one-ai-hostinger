'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

type LogRow = { id: string; action: string; createdAt: string; target?: string | null; actorEmail?: string | null; userEmail?: string | null; metadata?: unknown }
type LogResult = { total: number; page: number; pageSize: number; items: LogRow[] }

export default function AdminLogsPage() {
  const [kind, setKind] = useState<'audit' | 'activity'>('audit')
  const [q, setQ] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<LogResult>({ total: 0, page: 1, pageSize: 25, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ q, action, page: String(page), pageSize: '25' })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    try {
      const response = await fetch(`/api/admin/${kind}-logs?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load logs.')
      setResult(data)
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load logs.') }
    finally { setLoading(false) }
  }, [kind, q, action, from, to, page])

  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); return () => clearTimeout(timer) }, [load])
  function changeKind(next: 'audit' | 'activity') { setKind(next); setPage(1) }

  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">Audit and user activity</h2>
    <div className="flex flex-wrap gap-2"><button onClick={() => changeKind('audit')} className={`rounded-lg border px-4 py-2 ${kind === 'audit' ? 'bg-blue-600 text-white' : ''}`}>Audit logs</button><button onClick={() => changeKind('activity')} className={`rounded-lg border px-4 py-2 ${kind === 'activity' ? 'bg-blue-600 text-white' : ''}`}>User activity</button></div>
    <Card><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"><input value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Search actor, user, target, action" className="min-w-0 rounded-lg border bg-transparent p-2 lg:col-span-2"/><input value={action} onChange={e => { setAction(e.target.value); setPage(1) }} placeholder="Filter action" className="min-w-0 rounded-lg border bg-transparent p-2"/><label className="text-xs text-gray-500">From<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="mt-1 block w-full rounded-lg border bg-transparent p-2 text-sm"/></label><label className="text-xs text-gray-500">To<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="mt-1 block w-full rounded-lg border bg-transparent p-2 text-sm"/></label></div></Card>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <Card><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-3">Time</th><th className="p-3">Actor / user</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Safe metadata</th></tr></thead><tbody>{result.items.map(row=><tr key={row.id} className="border-b align-top"><td className="whitespace-nowrap p-3">{new Date(row.createdAt).toLocaleString()}</td><td className="p-3">{row.actorEmail||row.userEmail||'System'}</td><td className="p-3">{row.action}</td><td className="max-w-48 break-all p-3">{row.target||row.userEmail||'—'}</td><td className="max-w-md whitespace-pre-wrap break-words p-3 text-xs text-gray-500">{row.metadata?JSON.stringify(row.metadata):'—'}</td></tr>)}{!loading&&!result.items.length&&<tr><td colSpan={5} className="p-8 text-center text-gray-500">No matching logs.</td></tr>}</tbody></table></div><div className="flex items-center justify-between gap-3 pt-4 text-sm"><span>{loading?'Loading…':`${result.total.toLocaleString()} records`}</span><div className="flex gap-2"><button disabled={page<=1||loading} onClick={()=>setPage(value=>Math.max(1,value-1))} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><span className="self-center">Page {page}</span><button disabled={loading||page*result.pageSize>=result.total} onClick={()=>setPage(value=>value+1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></div></div></Card>
  </div>
}
