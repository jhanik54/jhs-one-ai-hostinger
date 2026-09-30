import 'server-only'
import type { ProviderName } from '@/types'
import { db } from '@/lib/db'
import { getAllKeys, selectBestKey, recordKeyUsage, acquireKey } from './keys'
import { callGemini } from './providers/gemini'
import { callGroq } from './providers/groq'
import { callOpenRouter } from './providers/openrouter'
import { getModelConfiguration } from './model-config'
import { AVAILABLE_MODELS } from './model-catalog'

type History = { role:'user'|'assistant'; content:string }[]
type ImageAttachment = { mimeType: string; data: string }
const callbacks:Record<'gemini'|'groq'|'openrouter',(key:string,msg:string,h:History,images:ImageAttachment[],model:string)=>Promise<ReadableStream>>={gemini:(key,msg,h,images,model)=>callGemini(key,msg,h,images,model),groq:(key,msg,h,_images,model)=>callGroq(key,msg,h,model),openrouter:(key,msg,h,images,model)=>callOpenRouter(key,msg,h,images,model)}
const failures=new Map<string,{count:number;until:number}>()
const modelRotation=new Map<string,number>()
const defaults:Record<'gemini'|'groq'|'openrouter',number>={gemini:40,groq:30,openrouter:30}
function weightedOrder(providers:('gemini'|'groq'|'openrouter')[], weights:Record<string,number>) {
  const remaining=[...providers];const out:typeof remaining=[]
  while(remaining.length){const total=remaining.reduce((n,p)=>n+Math.max(0,weights[p]??0),0);if(!total){out.push(...remaining);break}let roll=Math.random()*total;let chosen=remaining[0];for(const p of remaining){roll-=Math.max(0,weights[p]??0);if(roll<=0){chosen=p;break}}out.push(chosen);remaining.splice(remaining.indexOf(chosen),1)}
  return out
}
function selectConfiguredModel(provider:'gemini'|'groq'|'openrouter',enabled:string[],preferred:string,hasImages:boolean) {
  const supported=enabled.filter(model=>!hasImages||AVAILABLE_MODELS[provider].find(item=>item.id===model)?.capabilities.includes('vision'))
  if(!supported.length)return null
  const ordered=[preferred,...supported.filter(model=>model!==preferred)]
  const cursor=modelRotation.get(provider)||0
  modelRotation.set(provider,(cursor+1)%ordered.length)
  return ordered[cursor%ordered.length]
}

export async function routeAIRequest(message:string,history:History,configured?:ProviderName[],userId?:string,images:ImageAttachment[]=[]):Promise<{stream:ReadableStream;usedProvider:ProviderName;keyIndex:number;release:()=>void}> {
  const [activeRow,weightRow,modelConfiguration]=await Promise.all([db.appSetting.findUnique({where:{key:'active_providers'}}),db.appSetting.findUnique({where:{key:'provider_weights'}}),getModelConfiguration()])
  const valid=['gemini','groq','openrouter'] as const
  const setting=Array.isArray(activeRow?.value)?activeRow.value.filter((x):x is typeof valid[number]=>valid.includes(x as typeof valid[number])):valid
  const providers=(configured||setting).filter((x):x is typeof valid[number]=>valid.includes(x as typeof valid[number])&&modelConfiguration[x as typeof valid[number]].enabled.some(model=>!images.length||AVAILABLE_MODELS[x as typeof valid[number]].find(item=>item.id===model)?.capabilities.includes('vision')))
  const weights={...defaults,...(weightRow?.value&&typeof weightRow.value==='object'?weightRow.value as Record<string,number>:{})}
  const ordered=weightedOrder([...new Set(providers)],weights);let lastError:unknown
  for(const provider of ordered){const circuit=failures.get(provider);if(circuit&&circuit.until>Date.now())continue
    const keyStats=await db.providerKeyStat.findMany({where:{provider},select:{keyIndex:true,status:true,cooldownUntil:true}})
    const statusByIndex=new Map(keyStats.map(k=>[k.keyIndex,k]))
    const available=getAllKeys()[provider].filter(key=>{const status=statusByIndex.get(key.index);return !status||status.status!=='disabled'&&(!status.cooldownUntil||status.cooldownUntil<=new Date())})
    while(available.length){const key=selectBestKey(available);if(!key)break;available.splice(available.indexOf(key),1);const release=acquireKey(`${provider}-${key.index}`);const started=Date.now()
      try {const model=selectConfiguredModel(provider,modelConfiguration[provider].enabled,modelConfiguration[provider].defaultModel,images.length>0);if(!model){release();break}let timer:ReturnType<typeof setTimeout>|undefined;const stream=await Promise.race([callbacks[provider](key.key,message,history,images,model),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider timeout')),20000)})]).finally(()=>{if(timer)clearTimeout(timer)});recordKeyUsage(`${provider}-${key.index}`,true);failures.delete(provider);await db.providerKeyStat.upsert({where:{provider_keyIndex:{provider,keyIndex:key.index}},create:{id:`${provider}:${key.index}`,provider,keyIndex:key.index,status:'healthy',successCount:1},update:{status:'healthy',successCount:{increment:1},lastUsed:new Date(),lastSuccess:new Date(),cooldownUntil:null}}).catch(()=>undefined);return {stream,usedProvider:provider,keyIndex:key.index,release}}
      catch(error){release();lastError=error;const status=typeof error==='object'&&error!==null&&'status'in error?Number((error as {status?:number}).status):0;recordKeyUsage(`${provider}-${key.index}`,false,status===429?60000:30000);await db.providerLog.create({data:{provider,keyIndex:key.index,userId,success:false,responseTimeMs:Date.now()-started,statusCode:status||null,errorCode:status===429?'RATE_LIMIT':status===401||status===403?'INVALID_KEY':'PROVIDER_FAILURE'}}).catch(()=>undefined);await db.providerKeyStat.upsert({where:{provider_keyIndex:{provider,keyIndex:key.index}},create:{id:`${provider}:${key.index}`,provider,keyIndex:key.index,status:status===401||status===403?'disabled':'cooldown',failureCount:1,cooldownUntil:new Date(Date.now()+(status===429?60000:30000))},update:{status:status===401||status===403?'disabled':'cooldown',failureCount:{increment:1},lastUsed:new Date(),lastFailure:new Date(),cooldownUntil:new Date(Date.now()+(status===429?60000:30000))}}).catch(()=>undefined);if(status===401||status===403)available.splice(0,available.length);const previous=failures.get(provider)||{count:0,until:0};previous.count++;if(previous.count>=3){previous.until=Date.now()+60000;previous.count=0}failures.set(provider,previous)}
    }
  }
  throw lastError??new Error('No AI providers are currently available')
}
export function getActiveProviders():ProviderName[]{return ['gemini','groq','openrouter']}
