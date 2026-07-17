import { NextResponse } from 'next/server'
import { getServiceStatus } from '@/lib/service-process'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(getServiceStatus(id))
}
