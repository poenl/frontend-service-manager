import { NextResponse } from 'next/server'
import { unskipPause } from '@/lib/schedule'

export async function POST() {
  await unskipPause()
  return NextResponse.json({ ok: true })
}
