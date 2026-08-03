import { NextResponse } from 'next/server'
import { skipPause } from '@/lib/schedule'

export async function POST() {
  skipPause()
  return NextResponse.json({ ok: true })
}
