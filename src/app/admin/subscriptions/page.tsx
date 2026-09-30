'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Request = { id:string; status:string; priceAtRequest:string; user:{email:string;name:string|null}; plan:{name:string} }

export default function AdminSubscriptionsPage() {
  const [rows,setRows]=useState<Request[]>([])
  const [error,setError]=useState('')
  async function load(){const r=await fetch('/api/admin/subscriptions');const d=await r.json();if(r.ok)setRows(d);else setError(d.error||'Unable to load requests.')}
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer)},[])
  async function update(id:string,status:'approved'|'rejected'){const r=await fetch('/api/admin/subscriptions',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(r.ok)await load();else setError('Unable to update request.')}
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Subscription requests</h1>{error&&<p role="alert" className="text-red-600">{error}</p>}<Card><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left"><th className="p-3">User</th><th className="p-3">Package</th><th className="p-3">Price requested</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b"><td className="p-3">{row.user.name||row.user.email}<div className="text-xs text-gray-500">{row.user.email}</div></td><td className="p-3">{row.plan.name}</td><td className="p-3">BDT {row.priceAtRequest}</td><td className="p-3 capitalize">{row.status}</td><td className="p-3"><div className="flex gap-2"><Button size="sm" disabled={row.status!=='pending'} onClick={()=>void update(row.id,'approved')}>Approve</Button><Button size="sm" variant="danger" disabled={row.status!=='pending'} onClick={()=>void update(row.id,'rejected')}>Reject</Button></div></td></tr>)}{!rows.length&&<tr><td className="p-6 text-center text-gray-500" colSpan={5}>No subscription requests.</td></tr>}</tbody></table></div></Card></div>
}
