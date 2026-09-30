import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
export async function GET() {
  const id=process.env.GOOGLE_CLIENT_ID; const redirect=process.env.GOOGLE_REDIRECT_URI
  if(!id||!redirect)return NextResponse.json({error:'Google sign-in is not configured.'},{status:503})
  const state=randomBytes(24).toString('base64url'); const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.searchParams.set('client_id',id);url.searchParams.set('redirect_uri',redirect);url.searchParams.set('response_type','code');url.searchParams.set('scope','openid email profile');url.searchParams.set('state',state);url.searchParams.set('prompt','select_account')
  const response=NextResponse.redirect(url);response.cookies.set('jh_oauth_state',state,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:600,path:'/'});return response
}
