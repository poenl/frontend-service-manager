import { NextResponse } from 'next/server'
import { pauseAllServices } from '@/lib/service-process'

export async function POST() {
  const result = await pauseAllServices()
  return NextResponse.json(result)
}
