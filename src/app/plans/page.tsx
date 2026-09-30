'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Plan = { id: string; name: string; price: string | number; currency: string; messageLimit: number; pdfLimit: number; imageLimit: number; description: string | null; features: string[] | null; displayOrder:number }

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState('')
  const router = useRouter()
  useEffect(() => { void fetch('/api/plans').then(r => r.json()).then(d => setPlans(Array.isArray(d) ? d : [])).catch(() => setError('Plans are temporarily unavailable.')) }, [])
  async function buy(planId: string) {
    setError('')
    const r = await fetch('/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }) })
    const data = await r.json()
    if (r.status === 401) { router.push('/login'); return }
    if (!r.ok) { setError(data.error || 'Unable to start purchase.'); return }
    window.location.assign(data.url)
  }
  return <main className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-950"><div className="mx-auto max-w-4xl"><Link href="/chat" className="text-blue-600">← Back to chat</Link><h1 className="mt-6 text-3xl font-bold">Choose your JH One AI plan</h1><p className="mt-2 text-gray-500">Public packages are Standard and Premium. Usage resets daily.</p>{error && <p role="alert" className="mt-4 text-red-600">{error}</p>}<div className="mt-8 grid gap-5 md:grid-cols-2">{plans.map(plan => <section key={plan.id} className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-gray-900"><h2 className="text-xl font-semibold">{plan.name}</h2><p className="mt-2 text-3xl font-bold">{plan.currency} {Number(plan.price).toLocaleString()}</p><p className="mt-3 text-sm text-gray-500">{plan.description}</p><ul className="my-6 space-y-2 text-sm"><li>{plan.messageLimit} messages per day</li><li>{plan.pdfLimit} PDF uploads per day</li><li>{plan.imageLimit} image uploads per day</li>{(Array.isArray(plan.features)?plan.features:[]).map((feature,index)=><li key={`${plan.id}-${index}`}>{feature}</li>)}</ul><button onClick={() => buy(plan.id)} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700">Buy Now on WhatsApp</button></section>)}</div></div></main>
}
