import { NextRequest, NextResponse } from 'next/server'
import { getService, updateService, deleteService } from '@/lib/config'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = getService(id)
  if (!svc) return NextResponse.json({ error: '未找到' }, { status: 404 })
  return NextResponse.json(svc)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const svc = updateService(id, body)
  if (!svc) return NextResponse.json({ error: '未找到' }, { status: 404 })
  return NextResponse.json(svc)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = deleteService(id)
  if (!deleted) return NextResponse.json({ error: '未找到' }, { status: 404 })
  return NextResponse.json({ success: true })
}
