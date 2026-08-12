import { NextRequest, NextResponse } from 'next/server'
import { reorderServices } from '@/lib/config'
import { eventBus } from '@/lib/service-events'

// 接收拖拽后的 id 顺序，持久化并广播全量列表，使所有打开页面同步
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const ids: unknown = body?.ids
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: '无效的排序数据' }, { status: 400 })
  }
  const services = reorderServices(ids)
  if (!services) {
    return NextResponse.json({ error: '排序数据与现有服务不匹配' }, { status: 400 })
  }
  eventBus.emit('services', services)
  return NextResponse.json({ success: true })
}
