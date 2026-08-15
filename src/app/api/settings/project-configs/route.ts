import { statSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import {
  getProjectConfigs,
  addProjectConfig,
  removeProjectConfig,
  updateProjectConfig
} from '@/lib/config'
import { projectConfigSchema } from '@/lib/service-schema'

// 校验项目配置输入是否合法：schema 校验必填与环境变量名格式，path 须是真实存在的目录
function validateConfigInput(data: {
  name: string
  path: string
  backendEnvVar: string
}): string | null {
  const parsed = projectConfigSchema.safeParse(data)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? '输入不合法'
  if (!statSync(data.path, { throwIfNoEntry: false })?.isDirectory()) return '路径不存在或不是目录'
  return null
}

export async function GET() {
  return NextResponse.json(getProjectConfigs())
}

export async function POST(request: NextRequest) {
  const { name, path, backendEnvVar } = await request.json()
  const invalid = validateConfigInput({ name, path, backendEnvVar })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  // 后端权威校验：路径重复返回 409，避免前端跳过校验时的重复写入
  if (getProjectConfigs().some((c) => c.path === path)) {
    return NextResponse.json({ error: '该路径已存在' }, { status: 409 })
  }
  const result = addProjectConfig({ name, path, backendEnvVar })
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const { id, name, path, backendEnvVar } = await request.json()
  const invalid = validateConfigInput({ name, path, backendEnvVar })
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const result = updateProjectConfig(id, { name, path, backendEnvVar })
  if (!result) return NextResponse.json({ error: '更新失败' }, { status: 400 })
  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 })
  const result = removeProjectConfig(id)
  return NextResponse.json(result)
}
