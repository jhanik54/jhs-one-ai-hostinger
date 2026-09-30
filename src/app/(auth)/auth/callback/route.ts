import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { appUrl } from '@/lib/app-url'
export async function GET(req: NextRequest) {
  const {searchParams}=req.nextUrl;const code=searchParams.get('code');const state=searchParams.get('state');const jar=await cookies();const expected=jar.get('jh_oauth_state')?.value
  const fail=()=>{const response=NextResponse.redirect(appUrl('/login?error=auth_failed'));response.cookies.delete('jh_oauth_state');return response}
  if(!code||!state||!expected||state!==expected)return fail()
  const clientId=process.env.GOOGLE_CLIENT_ID;const clientSecret=process.env.GOOGLE_CLIENT_SECRET;const redirectUri=process.env.GOOGLE_REDIRECT_URI
  if(!clientId||!clientSecret||!redirectUri)return fail()
  try {
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}),cache:'no-store'})
    if(!tokenRes.ok)return fail();const tokenData=await tokenRes.json() as {access_token?:string};if(!tokenData.access_token)return fail()
    const profileRes=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:`Bearer ${tokenData.access_token}`},cache:'no-store'});if(!profileRes.ok)return fail()
    const profile=await profileRes.json() as {id?:string;email?:string;name?:string;picture?:string;verified_email?:boolean};if(!profile.id||!profile.email||!profile.verified_email)return fail()
    const email=profile.email.toLowerCase();const account=await db.account.findUnique({where:{provider_providerAccountId:{provider:'google',providerAccountId:profile.id}},include:{user:true}})
    let user=account?.user
    if(!user){user=await db.user.upsert({where:{email},create:{id:crypto.randomUUID().replaceAll('-',''),email,name:profile.name,image:profile.picture,profile:{create:{displayName:profile.name,avatarUrl:profile.picture}}},update:{name:profile.name,image:profile.picture}});await db.account.create({data:{userId:user.id,provider:'google',providerAccountId:profile.id}})}
    if(user.status!=='active')return fail()
    if(process.env.INITIAL_SUPERADMIN_EMAIL?.toLowerCase()===email)await db.adminUser.upsert({where:{userId:user.id},create:{userId:user.id,role:'superadmin'},update:{role:'superadmin'}})
    await createSession(user.id);await db.userActivityLog.create({data:{userId:user.id,action:'google_login'}})
    const response=NextResponse.redirect(appUrl('/chat'));response.cookies.delete('jh_oauth_state');return response
  } catch { return fail() }
}
