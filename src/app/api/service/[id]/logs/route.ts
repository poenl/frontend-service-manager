import { NextRequest, NextResponse } from 'next/server'
import { getServiceLogs } from '@/lib/service-process'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const since = Number(request.nextUrl.searchParams.get('since')) || 0
  return NextResponse.json(getServiceLogs(id, since))
}
