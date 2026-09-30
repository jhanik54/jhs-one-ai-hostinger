import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
export async function GET(){try{const plans=await db.plan.findMany({where:{active:true,id:{in:['STANDARD','PREMIUM']}},orderBy:{displayOrder:'asc'}});return NextResponse.json(plans)}catch{return NextResponse.json({error:'Plans are temporarily unavailable.'},{status:503})}}
