import { NextResponse } from 'next/server'
import { startService } from '@/lib/service-process'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await startService(id)
  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: result.status ?? 500 })
  }
  return NextResponse.json(result)
}
