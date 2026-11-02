import { statSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectConfigs,
  addProjectConfig,
  removeProjectConfig,
  resolveProjectPath,
  updateProjectConfig
} from '@/lib/config'
import { projectConfigSchema } from '@/lib/service-schema'
import { eventBus } from '@/lib/service-events'

// 路径须指向真实存在的目录（schema 负责字段校验，这里补文件系统校验）
function invalidPath(path: string): string | null {
  return statSync(resolveProjectPath(path), { throwIfNoEntry: false })?.isDirectory()
    ? null
    : '路径不存在或不是目录'
}

export async function GET() {
  return NextResponse.json(getProjectConfigs())
}

export async function POST(request: NextRequest) {
  // 整体交给 schema 解析（未知键由 zod 丢弃），按 type 校验各自必填字段
  const parsed = projectConfigSchema.safeParse(await request.json())
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '输入不合法' },
      { status: 400 }
    )
  const input = parsed.data
  const pathError = invalidPath(input.path)
  if (pathError) return NextResponse.json({ error: pathError }, { status: 400 })
  // 后端权威校验：路径重复返回 409，避免前端跳过校验时的重复写入
  if (getProjectConfigs().some((c) => c.path === input.path)) {
    return NextResponse.json({ error: '该路径已存在' }, { status: 409 })
  }
  const result = addProjectConfig(input)
  // 推送全量列表，让其他页面的服务配置选择器实时更新
  eventBus.emit('project-configs', result)
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const parsed = projectConfigSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '输入不合法' },
      { status: 400 }
    )
  const pathError = invalidPath(parsed.data.path)
  if (pathError) return NextResponse.json({ error: pathError }, { status: 400 })
  const result = updateProjectConfig(body.id, parsed.data)
  if (!result) return NextResponse.json({ error: '更新失败' }, { status: 400 })
  eventBus.emit('project-configs', result)
  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 })
  const result = removeProjectConfig(id)
  eventBus.emit('project-configs', result)
  return NextResponse.json(result)
}
