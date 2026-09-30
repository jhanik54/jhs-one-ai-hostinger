import { NextResponse, type NextRequest } from 'next/server'
import { appUrl } from '@/lib/app-url'
export function proxy(req:NextRequest){const protectedPath=req.nextUrl.pathname.startsWith('/chat')||req.nextUrl.pathname.startsWith('/admin');if(protectedPath&&!req.cookies.has('jh_session'))return NextResponse.redirect(appUrl('/login'));return NextResponse.next()}
export const config={matcher:['/chat/:path*','/admin/:path*']}
