import { NextRequest,NextResponse } from 'next/server'
import { randomBytes,createHash } from 'node:crypto'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}) {
  try {
    const admin=await requireAdmin();const {id}=await ctx.params
    const body=await req.json() as {status?:string;planId?:string;resetPassword?:boolean;revokeSessions?:boolean}
    if(body.status&&!['active','disabled'].includes(body.status))return NextResponse.json({error:'Invalid account state.'},{status:400})
    if(body.planId&&!['NORMAL','STANDARD','PREMIUM'].includes(body.planId))return NextResponse.json({error:'Ultra can only be granted through admin role.'},{status:400})
    if(!await db.user.findUnique({where:{id},select:{id:true}}))return NextResponse.json({error:'User not found.'},{status:404})
    let resetUrl:string|undefined
    await db.$transaction(async tx=>{
      if(body.status)await tx.user.update({where:{id},data:{status:body.status}})
      if(body.planId){await tx.subscription.updateMany({where:{userId:id,status:'approved'},data:{status:'cancelled'}});if(body.planId!=='NORMAL')await tx.subscription.create({data:{userId:id,planId:body.planId,status:'approved',priceAtRequest:0}})}
      if(body.status==='disabled'||body.resetPassword||body.revokeSessions)await tx.session.deleteMany({where:{userId:id}})
      if(body.resetPassword){const token=randomBytes(32).toString('base64url');const tokenHash=createHash('sha256').update(token).digest('hex');await tx.passwordResetToken.create({data:{id:tokenHash,userId:id,expiresAt:new Date(Date.now()+3600000)}});resetUrl=`${process.env.APP_URL||req.nextUrl.origin}/reset-password?token=${encodeURIComponent(token)}`}
      await tx.auditLog.create({data:{actorId:admin.id,action:body.resetPassword?'password_reset_initiated':body.revokeSessions?'sessions_revoked':'user_updated',target:id,metadata:{...(body.status?{status:body.status}:{}),...(body.planId?{planId:body.planId}:{})}}})
    })
    return NextResponse.json({success:true,...(resetUrl?{resetUrl}:{})})
  } catch { return NextResponse.json({error:'Unable to update user.'},{status:403}) }
}
