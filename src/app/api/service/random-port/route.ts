import { NextRequest, NextResponse } from 'next/server'
import { getServices } from '@/lib/config'
import { isPortInUse } from '@/lib/service-process'

// 随机端口范围：3000-9999（前端开发常用端口段）
const PORT_MIN = 3000
const PORT_RANGE = 7000 // 9999 - 3000 + 1
// 随机碰撞后最多重试次数，覆盖绝大多数占用情况
const MAX_ATTEMPTS = 30

export async function GET(request: NextRequest) {
  // 从请求 host header 解析本服务管理器自身端口，避免与宿主冲突
  const host = request.headers.get('host') ?? ''
  const managerPort = host.split(':')[1] ?? ''

  const usedPorts = new Set<string>()
  if (managerPort) usedPorts.add(managerPort)
  for (const svc of getServices()) {
    if (svc.frontendPort) usedPorts.add(svc.frontendPort)
  }

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const port = PORT_MIN + Math.floor(Math.random() * PORT_RANGE)
    if (usedPorts.has(String(port))) continue
    if (await isPortInUse(port)) continue
    return NextResponse.json({ port })
  }

  return NextResponse.json({ error: '未找到可用端口' }, { status: 409 })
}
