import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { maintenanceResponse } from '@/lib/maintenance'
export async function PATCH(req:NextRequest,ctx:{params:Promise<{id:string}>}){try{const user=await requireUser();const unavailable=await maintenanceResponse(Boolean(user.admin));if(unavailable)return unavailable;const {id}=await ctx.params;const body=await req.json();if(typeof body.title!=='string'||!body.title.trim())return NextResponse.json({error:'A title is required.'},{status:400});const result=await db.conversation.updateMany({where:{id,userId:user.id},data:{title:body.title.trim().slice(0,255)}});return result.count?NextResponse.json({success:true}):NextResponse.json({error:'Conversation not found.'},{status:404})}catch{return NextResponse.json({error:'Unable to update conversation.'},{status:401})}}
