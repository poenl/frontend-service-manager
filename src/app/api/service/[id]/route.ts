import { NextRequest, NextResponse } from 'next/server'
import { getService, updateService, deleteService } from '@/lib/config'
import { getServiceStatus } from '@/lib/service-process'

const RUNNING_BLOCKED_FIELDS = ['projectDir', 'backendHost', 'backendPort', 'frontendPort'] as const

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = getService(id)
  if (!svc) return NextResponse.json({ error: '未找到' }, { status: 404 })
  return NextResponse.json(svc)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const status = getServiceStatus(id)
  if (status.running) {
    const blocked = RUNNING_BLOCKED_FIELDS.filter((f) => f in body)
    if (blocked.length > 0) {
      return NextResponse.json(
        { error: `服务运行中，无法修改：${blocked.join('、')}` },
        { status: 400 }
      )
    }
  }
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
