'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { sseClient } from '@/lib/sse-client'
import { useSSE } from '@/lib/use-sse'
import {
  fetchProjectDirs,
  addProjectDir,
  removeProjectDir,
  updateProjectDir
} from '@/lib/settings-api'
import type { ProjectDir } from '@/lib/config'

interface DirEntry {
  name: string
  path: string
}

export default function SettingsPage() {
  const [dirs, setDirs] = useState<DirEntry[]>([])
  const [newName, setNewName] = useState('')
  const [newPath, setNewPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPath, setEditPath] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchProjectDirs()
        setDirs(data)
      } catch {
        toast.error('加载项目目录失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // SSR 连接：监听其他页面的 project-dirs 变更
  useEffect(() => {
    sseClient.connect()
    return () => sseClient.disconnect()
  }, [])

  useSSE('project-dirs', (data: ProjectDir[]) => {
    setDirs(data)
  })

  const handleAdd = async () => {
    const name = newName.trim()
    const path = newPath.trim()
    if (!name || !path) return
    if (dirs.some((d) => d.path === path)) {
      toast.error('该路径已存在')
      return
    }
    try {
      const updated = await addProjectDir({ name, path })
      setDirs(updated)
      setNewName('')
      setNewPath('')
    } catch {
      toast.error('添加失败')
    }
  }

  const handleRemove = async (path: string) => {
    try {
      const updated = await removeProjectDir(path)
      setDirs(updated)
    } catch {
      toast.error('删除失败')
    }
  }

  const handleEdit = async () => {
    if (!editingPath) return
    const name = editName.trim()
    const path = editPath.trim()
    if (!name || !path) return
    if (path !== editingPath && dirs.some((d) => d.path === path)) {
      toast.error('该路径已存在')
      return
    }
    try {
      const updated = await updateProjectDir(editingPath, { name, path })
      setDirs(updated)
      setEditingPath(null)
    } catch {
      toast.error('编辑失败')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">加载中...</div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 max-w-lg mx-auto w-full">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回服务管理
            </Link>
          </div>
          <CardTitle>全局设置</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">项目目录列表</h3>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-3">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="名称"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Input
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="/path/to/project"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <Button onClick={handleAdd} disabled={!newName.trim() || !newPath.trim()}>
                添加
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              {dirs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无项目目录</p>
              ) : (
                dirs.map((dir) => (
                  <div
                    key={dir.path}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium truncate">{dir.name}</span>
                      <code className="font-mono text-xs text-muted-foreground shrink-0">
                        {dir.path}
                      </code>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPath(dir.path)
                          setEditName(dir.name)
                          setEditPath(dir.path)
                        }}
                      >
                        编辑
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
                          删除
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除项目目录「{dir.name || dir.path}」吗？
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleRemove(dir.path)}
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* 编辑项目目录弹窗 */}
          <AlertDialog
            open={editingPath !== null}
            onOpenChange={(open) => {
              if (!open) setEditingPath(null)
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>编辑项目目录</AlertDialogTitle>
              </AlertDialogHeader>
              <div className="flex flex-col gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="名称"
                />
                <Input
                  value={editPath}
                  onChange={(e) => setEditPath(e.target.value)}
                  placeholder="/path/to/project"
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleEdit}>保存</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  )
}
