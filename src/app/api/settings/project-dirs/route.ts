import { NextRequest, NextResponse } from 'next/server'
import { getProjectDirs, addProjectDir, removeProjectDir, updateProjectDir } from '@/lib/config'

export async function GET() {
  return NextResponse.json(getProjectDirs())
}

export async function POST(request: NextRequest) {
  const { name, path } = await request.json()
  // 后端权威校验：路径重复返回 409，避免前端跳过校验时的重复写入
  if (getProjectDirs().some((d) => d.path === path)) {
    return NextResponse.json({ error: '该路径已存在' }, { status: 409 })
  }
  const result = addProjectDir({ name, path })
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest) {
  const { oldPath, name, path } = await request.json()
  const result = updateProjectDir(oldPath, { name, path })
  if (!result) return NextResponse.json({ error: '更新失败' }, { status: 400 })
  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: '缺少 path 参数' }, { status: 400 })
  const result = removeProjectDir(path)
  return NextResponse.json(result)
}
