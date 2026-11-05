import { NextResponse } from 'next/server'
import { startService, stopService } from '@/lib/service-process'

// 重启：先停后起，一次请求完成，避免客户端编排两次请求时的状态闪断与竞态
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // 仅运行中的服务可重启；停止失败（如未在运行）直接返回其错误
  const stopped = await stopService(id)
  if (!stopped.success) {
    return NextResponse.json({ error: stopped.message }, { status: stopped.status ?? 500 })
  }
  const result = await startService(id)
  if (!result.success) {
    return NextResponse.json({ error: result.message }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ success: true, message: '服务已重启' })
}
