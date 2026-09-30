import { NextRequest,NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { rateLimited } from '@/lib/rate-limit'

export async function POST(req:NextRequest){
  try {
    const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
    if(rateLimited(`reset:${address}`,8,60*60_000))return NextResponse.json({error:'Too many reset attempts. Please try again later.'},{status:429})
    const {token,password}=await req.json() as {token?:string;password?:string}
    if(!token||!password||password.length<10||password.length>128)return NextResponse.json({error:'A valid reset token and a password of at least 10 characters are required.'},{status:400})
    const id=createHash('sha256').update(token).digest('hex')
    const row=await db.passwordResetToken.findUnique({where:{id}})
    if(!row||row.usedAt||row.expiresAt<new Date())return NextResponse.json({error:'This reset link is invalid or expired.'},{status:400})
    const hash=await hashPassword(password)
    const applied=await db.$transaction(async tx=>{
      const claim=await tx.passwordResetToken.updateMany({where:{id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date()}})
      if(!claim.count)return false
      await tx.user.update({where:{id:row.userId},data:{passwordHash:hash,mustChangePassword:false}})
      await tx.session.deleteMany({where:{userId:row.userId}})
      return true
    })
    if(!applied)return NextResponse.json({error:'This reset link has already been used.'},{status:400})
    return NextResponse.json({success:true})
  } catch { return NextResponse.json({error:'Unable to reset password.'},{status:500}) }
}
