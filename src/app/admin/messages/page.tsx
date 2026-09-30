'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'

type AdminMessage = { id: string; role: string; excerpt: string; createdAt: string; conversationId: string; conversationTitle: string; userId: string; userEmail: string }
type Results = { total: number; today: number; page: number; pageSize: number; items: AdminMessage[] }

export default function AdminMessagesPage() {
  const [q, setQ] = useState('')
  const [userId, setUserId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [role, setRole] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Results>({ total: 0, today: 0, page: 1, pageSize: 25, items: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: '25' })
    for (const [key, value] of Object.entries({ q, userId, conversationId, role, from, to })) if (value) params.set(key, value)
    try {
      const response = await fetch(`/api/admin/messages?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load messages.')
      setData(result); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load messages.') }
    finally { setLoading(false) }
  }, [q, userId, conversationId, role, from, to, page])
  useEffect(() => { const timer = setTimeout(() => { void load() }, 0); return () => clearTimeout(timer) }, [load])
  const resetPage = (setter: (value: string) => void) => (value: string) => { setter(value); setPage(1) }

  return <div className="space-y-6">
    <h2 className="text-2xl font-bold">Message monitoring</h2>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Card><p className="text-sm text-gray-500">Matching messages</p><p className="text-2xl font-bold">{data.total.toLocaleString()}</p></Card><Card><p className="text-sm text-gray-500">Messages today</p><p className="text-2xl font-bold">{data.today.toLocaleString()}</p></Card></div>
    <Card><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"><input value={q} onChange={e=>resetPage(setQ)(e.target.value)} placeholder="Search message content" className="min-w-0 rounded-lg border bg-transparent p-2 lg:col-span-2"/><input value={userId} onChange={e=>resetPage(setUserId)(e.target.value)} placeholder="Filter user ID" className="min-w-0 rounded-lg border bg-transparent p-2"/><input value={conversationId} onChange={e=>resetPage(setConversationId)(e.target.value)} placeholder="Conversation ID" className="min-w-0 rounded-lg border bg-transparent p-2"/><select value={role} onChange={e=>resetPage(setRole)(e.target.value)} className="rounded-lg border bg-transparent p-2"><option value="">All roles</option><option value="user">User</option><option value="assistant">Assistant</option></select><label className="text-xs text-gray-500">From<input type="date" value={from} onChange={e=>resetPage(setFrom)(e.target.value)} className="mt-1 block w-full rounded-lg border bg-transparent p-2 text-sm"/></label><label className="text-xs text-gray-500">To<input type="date" value={to} onChange={e=>resetPage(setTo)(e.target.value)} className="mt-1 block w-full rounded-lg border bg-transparent p-2 text-sm"/></label></div><p className="mt-2 text-xs text-gray-500">Message contents are shown only in this admin view and truncated to 600 characters.</p></Card>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    <Card><div className="space-y-2">{data.items.map(message=><article key={message.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800"><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500"><span className={`rounded px-2 py-0.5 ${message.role==='user'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700'}`}>{message.role}</span><span>{message.userEmail}</span><span>{message.conversationTitle}</span><span className="break-all">{message.conversationId}</span><time className="sm:ml-auto">{new Date(message.createdAt).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.excerpt}{message.excerpt.length>=600?'…':''}</p></article>)}{!loading&&!data.items.length&&<p className="p-8 text-center text-gray-500">No matching messages.</p>}</div><div className="flex items-center justify-between gap-3 pt-4 text-sm"><span>{loading?'Loading…':`${data.total.toLocaleString()} matching records`}</span><div className="flex gap-2"><button disabled={page<=1||loading} onClick={()=>setPage(value=>Math.max(1,value-1))} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><span className="self-center">Page {page}</span><button disabled={loading||page*data.pageSize>=data.total} onClick={()=>setPage(value=>value+1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></div></div></Card>
  </div>
}
