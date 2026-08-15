'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { toast } from '@/components/ui/toast'
import type { ProjectConfig } from '@/lib/config'
import {
  fetchProjectConfigs,
  addProjectConfig,
  removeProjectConfig,
  updateProjectConfig
} from '@/lib/settings-api'
import ProjectConfigFormDialog, { type DirValues } from './project-config-form-dialog'

export default function ProjectConfigsPanel() {
  const [dirs, setDirs] = useState<ProjectConfig[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingDir, setEditingDir] = useState<ProjectConfig | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchProjectConfigs()
        setDirs(data)
      } catch {
        // 错误提示已由 request 工具统一处理
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleAdd = async ({ name, path, backendEnvVar }: DirValues) => {
    if (dirs.some((d) => d.path === path)) {
      toast.add({ type: 'error', title: '该路径已存在' })
      return
    }
    try {
      const updated = await addProjectConfig({ name, path, backendEnvVar })
      setDirs(updated)
      setAddOpen(false)
    } catch {
      // 错误提示已由 request 工具统一处理
    }
  }

  const handleRemove = async (id: string) => {
    try {
      const updated = await removeProjectConfig(id)
      setDirs(updated)
    } catch {
      // 错误提示已由 request 工具统一处理
    }
  }

  const handleEdit = async ({ name, path, backendEnvVar }: DirValues) => {
    if (!editingDir) return
    if (path !== editingDir.path && dirs.some((d) => d.path === path)) {
      toast.add({ type: 'error', title: '该路径已存在' })
      return
    }
    try {
      const updated = await updateProjectConfig(editingDir.id, { name, path, backendEnvVar })
      setDirs(updated)
      setEditingDir(null)
    } catch {
      // 错误提示已由 request 工具统一处理
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">加载中...</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center justify-between">
            项目配置
            <Button size="sm" onClick={() => setAddOpen(true)}>
              添加
            </Button>
          </h3>
          <div className="flex flex-col gap-1.5">
            {dirs.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无项目配置</p>
            ) : (
              dirs.map((dir) => (
                <div
                  key={dir.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-medium truncate shrink-0 min-w-0">{dir.name}</span>
                    <code className="font-mono text-xs text-muted-foreground truncate min-w-0">
                      {dir.path}
                    </code>
                    <code className="font-mono text-xs text-muted-foreground truncate min-w-0">
                      {dir.backendEnvVar}
                    </code>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDir(dir)
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
                            确定要删除项目配置「{dir.name || dir.path}」吗？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => handleRemove(dir.id)}
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

        <ProjectConfigFormDialog
          key={addOpen ? 'add-open' : 'add-closed'}
          open={addOpen}
          title="添加项目配置"
          onSubmit={handleAdd}
          onOpenChange={(open) => {
            if (!open) setAddOpen(false)
          }}
        />

        <ProjectConfigFormDialog
          key={editingDir?.id ?? 'none'}
          open={editingDir !== null}
          title="编辑项目配置"
          initial={editingDir ?? undefined}
          onSubmit={handleEdit}
          onOpenChange={(open) => {
            if (!open) {
              setEditingDir(null)
            }
          }}
        />
      </CardContent>
    </Card>
  )
}
