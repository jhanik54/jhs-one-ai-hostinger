import { NextResponse, type NextRequest } from 'next/server'
export function proxy(req:NextRequest){const protectedPath=req.nextUrl.pathname.startsWith('/chat')||req.nextUrl.pathname.startsWith('/admin');if(protectedPath&&!req.cookies.has('jh_session'))return NextResponse.redirect(new URL('/login',req.url));return NextResponse.next()}
export const config={matcher:['/chat/:path*','/admin/:path*']}
