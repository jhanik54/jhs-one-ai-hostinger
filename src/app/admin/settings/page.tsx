'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

type PlanSetting = { id:string;name:string;price:string|number;messageLimit:number;pdfLimit:number;imageLimit:number;active:boolean;description:string|null;features:string[]|null;displayOrder:number }
type ModelConfig=Record<'gemini'|'groq'|'openrouter',{enabled:string[];defaultModel:string}>
type ModelOption={id:string;label:string;capabilities:('text'|'vision')[]}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [plans,setPlans]=useState<PlanSetting[]>([])
  const [whatsapp,setWhatsapp]=useState('')
  const [weights,setWeights]=useState<Record<string,number>>({gemini:40,groq:30,openrouter:30})
  const [keyCounts,setKeyCounts]=useState<Record<string,number>>({})
  const [availableModels,setAvailableModels]=useState<Record<string,ModelOption[]>>({})
  const [modelConfig,setModelConfig]=useState<ModelConfig|null>(null)

  useEffect(() => {
    Promise.all([fetch('/api/admin/settings').then(r=>r.json()),fetch('/api/admin/plans').then(r=>r.json()),fetch('/api/admin/providers').then(r=>r.json()),fetch('/api/admin/models').then(r=>r.json())])
      .then(([d,p,providers,models]) => { setSettings(d);setWhatsapp(typeof d.whatsapp_number==='string'?d.whatsapp_number:'');if(d.provider_weights&&typeof d.provider_weights==='object')setWeights(d.provider_weights as Record<string,number>);setPlans(Array.isArray(p)?p.map(plan=>({...plan,features:Array.isArray(plan.features)?plan.features.filter((feature:unknown):feature is string=>typeof feature==='string'):[]})):[]);if(providers.key_stats)setKeyCounts(Object.fromEntries(Object.entries(providers.key_stats).map(([key,value])=>[key,(value as {total:number}).total])));if(models.available)setAvailableModels(models.available);if(models.configuration)setModelConfig(models.configuration);setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const toggleProvider = async (provider: string) => {
    const current: string[] = Array.isArray(settings.active_providers) ? settings.active_providers.filter((x):x is string=>typeof x==='string') : ['gemini', 'groq', 'openrouter']
    const updated = current.includes(provider)
      ? current.filter(p => p !== provider)
      : [...current, provider]

    setSaving(true)
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'active_providers', value: updated }),
    })
    setSettings(prev => ({ ...prev, active_providers: updated }))
    setSaving(false)
    setMessage(`Provider ${provider} ${current.includes(provider) ? 'disabled' : 'enabled'}`)
    setTimeout(() => setMessage(''), 3000)
  }
  const updatePlan=async(plan:PlanSetting)=>{setSaving(true);const r=await fetch('/api/admin/plans',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...plan,features:plan.features||[]})});const result=await r.json();setSaving(false);setMessage(r.ok?`${plan.name} plan saved.`:result.error||'Unable to save plan.');setTimeout(()=>setMessage(''),3000)}
  const saveWhatsApp=async()=>{setSaving(true);const r=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'whatsapp_number',value:whatsapp})});setSaving(false);setMessage(r.ok?'WhatsApp number saved.':'Unable to save WhatsApp number.');setTimeout(()=>setMessage(''),3000)}
  const saveWeights=async()=>{setSaving(true);const r=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'provider_weights',value:weights})});setSaving(false);setMessage(r.ok?'Provider weights saved.':'Unable to save weights.');setTimeout(()=>setMessage(''),3000)}
  const saveModels=async()=>{if(!modelConfig)return;setSaving(true);const r=await fetch('/api/admin/models',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({configuration:modelConfig})});const data=await r.json();if(r.ok)setModelConfig(data.configuration);setSaving(false);setMessage(r.ok?'Model configuration saved.':data.error||'Unable to save model configuration.');setTimeout(()=>setMessage(''),4000)}
  const toggleFlag=async(key:string)=>{const updated=settings[key]!==true;setSaving(true);const r=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:updated})});setSaving(false);if(r.ok)setSettings(prev=>({...prev,[key]:updated}));setMessage(r.ok?'System setting saved.':'Unable to save setting.');setTimeout(()=>setMessage(''),3000)}

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  const providers = [
    { id: 'gemini', name: 'Gemini' },
    { id: 'groq', name: 'Groq' },
    { id: 'openrouter', name: 'OpenRouter' },
  ]

  const activeProviders: string[] = Array.isArray(settings.active_providers) ? settings.active_providers.filter((x):x is string=>typeof x==='string') : providers.map(p => p.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
        {message && <Badge variant="success">{message}</Badge>}
      </div>

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">AI Providers</h3>
        <p className="text-sm text-gray-500 mb-4">Toggle AI providers on/off. Disabled providers will be skipped during routing.</p>
        <div className="space-y-3">
          {providers.map(p => {
            const isActive = activeProviders.includes(p.id)
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                    <p className="text-xs text-gray-500">{keyCounts[p.id]||0} configured API keys</p>
                  </div>
                </div>
                <Button
                  variant={isActive ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => toggleProvider(p.id)}
                  disabled={saving}
                >
                  {isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            )
          })}
        </div>
      </Card>

      <Card><h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Provider weights</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{providers.map(provider=><label key={provider.id} className="text-sm text-gray-500">{provider.name}<input type="number" min={0} max={100} value={weights[provider.id]??0} onChange={e=>setWeights(prev=>({...prev,[provider.id]:Number(e.target.value)}))} className="mt-1 w-full rounded-lg border bg-transparent p-2"/></label>)}</div><Button className="mt-4" disabled={saving} onClick={saveWeights}>Save weights</Button></Card>

      {modelConfig&&<Card><h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Provider models</h3><p className="mb-4 text-sm text-gray-500">Choose enabled models per provider and select which model the gateway prefers for that provider.</p><div className="space-y-4">{providers.map(provider=>{const providerConfig=modelConfig[provider.id as keyof ModelConfig];const options=availableModels[provider.id]||[];return <section key={provider.id} className="rounded-xl bg-gray-50 p-4 dark:bg-gray-900"><h4 className="mb-3 font-medium capitalize">{provider.name}</h4><div className="space-y-2">{options.map(model=><label key={model.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={providerConfig.enabled.includes(model.id)} onChange={event=>setModelConfig(current=>{if(!current)return current;const enabled=event.target.checked?[...current[provider.id as keyof ModelConfig].enabled,model.id]:current[provider.id as keyof ModelConfig].enabled.filter(id=>id!==model.id);const nextDefault=event.target.checked?current[provider.id as keyof ModelConfig].defaultModel:(current[provider.id as keyof ModelConfig].defaultModel===model.id?enabled[0]:current[provider.id as keyof ModelConfig].defaultModel);return {...current,[provider.id]:{enabled,defaultModel:nextDefault||''}}})}/><span>{model.label}</span><span className="text-xs text-gray-500">{model.capabilities.join(', ')}</span></label>)}</div><label className="mt-3 block text-sm">Default model<select value={providerConfig.defaultModel} onChange={event=>setModelConfig(current=>current?{...current,[provider.id]:{...current[provider.id as keyof ModelConfig],defaultModel:event.target.value}}:current)} className="mt-1 w-full rounded-lg border bg-white p-2 dark:bg-gray-950">{options.filter(model=>providerConfig.enabled.includes(model.id)).map(model=><option key={model.id} value={model.id}>{model.label}</option>)}</select></label></section>})}</div><Button className="mt-4" disabled={saving} onClick={saveModels}>Save model configuration</Button></Card>}

      <Card>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Plans and limits</h3>
        <div className="space-y-4">{plans.map(plan=><div key={plan.id} className="grid gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-4"><div className="flex items-center justify-between gap-3"><div className="font-medium">{plan.name} <span className="text-xs text-gray-500">{plan.id==='ULTRA'?'(internal)':`(${plan.id})`}</span></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={['STANDARD','PREMIUM'].includes(plan.id)&&plan.active} disabled={!['STANDARD','PREMIUM'].includes(plan.id)} onChange={e=>setPlans(prev=>prev.map(p=>p.id===plan.id?{...p,active:e.target.checked}:p))}/>{['STANDARD','PREMIUM'].includes(plan.id)?'Public':'Internal'}</label></div>{([['Price BDT','price'],['Messages/day','messageLimit'],['PDFs/day','pdfLimit'],['Images/day','imageLimit'],['Display order','displayOrder']] as const).map(([label,key])=><label key={key} className="text-xs text-gray-500">{label}<input type="number" min={key==='price'||key==='displayOrder'?0:plan.id==='ULTRA'?-1:0} step={key==='price'?'0.01':'1'} value={plan[key]} onChange={e=>setPlans(prev=>prev.map(p=>p.id===plan.id?{...p,[key]:Number(e.target.value)}:p))} className="mt-1 w-full rounded-lg border bg-white p-2 text-sm dark:bg-gray-950" /></label>)}<label className="text-xs text-gray-500 lg:col-span-2">Description<textarea maxLength={5000} value={plan.description||''} onChange={e=>setPlans(prev=>prev.map(p=>p.id===plan.id?{...p,description:e.target.value}:p))} className="mt-1 min-h-20 w-full rounded-lg border bg-white p-2 text-sm dark:bg-gray-950"/></label><label className="text-xs text-gray-500 lg:col-span-2">Features (one per line)<textarea value={(plan.features||[]).join('\n')} onChange={e=>setPlans(prev=>prev.map(p=>p.id===plan.id?{...p,features:e.target.value.split('\n').map(feature=>feature.trim()).filter(Boolean).slice(0,30)}:p))} className="mt-1 min-h-20 w-full rounded-lg border bg-white p-2 text-sm dark:bg-gray-950"/></label><div className="lg:col-span-4"><Button size="sm" disabled={saving} onClick={()=>updatePlan(plan)}>Save {plan.name}</Button></div></div>)}</div>
      </Card>

      <Card><h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">WhatsApp purchases</h3><div className="flex flex-col gap-3 sm:flex-row"><input value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="Business number with country code" className="min-w-0 flex-1 rounded-lg border bg-transparent p-3"/><Button disabled={saving} onClick={saveWhatsApp}>Save number</Button></div></Card>

      <Card><h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">System controls</h3><div className="space-y-3">{([{key:'maintenance_mode',label:'Maintenance mode',defaultOn:false},{key:'registrations_enabled',label:'New registrations',defaultOn:true},{key:'subscriptions_enabled',label:'New subscriptions',defaultOn:true}] as const).map(flag=>{const enabled=typeof settings[flag.key]==='boolean'?settings[flag.key]===true:flag.defaultOn;return <div key={flag.key} className="flex items-center justify-between gap-3"><span className="text-sm">{flag.label}: {enabled?'Enabled':'Disabled'}</span><Button size="sm" variant={enabled?'danger':'primary'} disabled={saving} onClick={()=>void toggleFlag(flag.key)}>{enabled?'Disable':'Enable'}</Button></div>})}</div></Card>

    </div>
  )
}
