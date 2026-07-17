import { NextResponse } from 'next/server'
import { resumeAllServices } from '@/lib/service-process'

export async function POST() {
  const result = await resumeAllServices()
  return NextResponse.json(result)
}
