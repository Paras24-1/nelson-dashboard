import { NextRequest, NextResponse } from 'next/server'
import { getOrgId } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Safely return only configuration URLs (no sensitive keys)
    return NextResponse.json({
      GATEWAY_URL: process.env.GATEWAY_URL || null,
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || null,
      NODE_ENV: process.env.NODE_ENV || null
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
