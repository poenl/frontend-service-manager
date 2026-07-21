'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  InputGroup,
  InputGroupText,
  InputGroupAddon,
  InputGroupInput
} from '@/components/ui/input-group'
import anser from 'anser'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import type { ServiceConfig, ProjectDir } from '@/lib/config'

interface ServiceDetailPanelProps {
  services: ServiceConfig[]
  selectedId: string
  running: Record<string, boolean>
  logs: Record<string, string[]>
  projectDirs: ProjectDir[]
  hostname: string
  busy: { id: string; action: 'start' | 'stop' } | null
  logEndRef: React.RefObject<HTMLDivElement | null>
  isLocal: boolean
  onSave: (id: string, patch: Partial<ServiceConfig>) => void
  onDelete: (id: string) => Promise<boolean>
  onServiceAction: (id: string, action: 'start' | 'stop') => void
}

/**
 * 右侧详情面板：服务配置 + 服务控制 + 运行日志
 * 无状态组件，所有数据和回调均由父组件传入
 */
export default function ServiceDetailPanel({
  services,
  selectedId,
  running,
  logs,
  projectDirs,
  hostname,
  busy,
  logEndRef,
  isLocal,
  onSave,
  onDelete,
  onServiceAction
}: ServiceDetailPanelProps) {
  const [frontendPortError, setFrontendPortError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const selected = services.find((s) => s.id === selectedId)
  // Hooks 必须在条件返回前调用
  const frontendUrl = useFrontendUrl(selected?.frontendPort, !!running[selectedId], hostname)

  if (!selected) return null

  const selectedDir = projectDirs.find((p) => p.path === selected.projectDir)
  const isRunning = !!running[selectedId]

  const fieldErrors = {
    name: touched.name && !selected.name ? '请输入服务名称' : null,
    projectDir: touched.projectDir && !selected.projectDir ? '请输入项目目录' : null,
    backendHost: touched.backendHost && !selected.backendHost ? '请输入后端地址' : null,
    backendPort: touched.backendPort && !selected.backendPort ? '请输入后端端口' : null,
    frontendPort: touched.frontendPort && !selected.frontendPort ? '请输入前端端口' : null
  }

  // 后端地址输入处理：清洗 http:// 前缀，自动提取端口
  const handleBackendHostChange = (id: string, value: string) => {
    const raw = value.replace(/^https?:\/\//, '')
    const match = raw.match(/^(.+?):(\d+)$/)
    if (match) {
      onSave(id, { backendHost: match[1], backendPort: match[2] })
    } else {
      onSave(id, { backendHost: raw })
    }
  }

  // 前端端口输入处理：禁止与本项目端口冲突，禁止与其他服务重复
  const handleFrontendPortChange = (id: string, value: string) => {
    const clean = value.replace(/\D/g, '')
    const currentPort = window.location.port
    let error: string | null = null

    if (clean === currentPort) {
      error = `端口 ${currentPort} 与本服务端口冲突`
    } else if (clean) {
      const conflict = services.find((s) => s.id !== id && s.frontendPort === clean)
      if (conflict) {
        error = `端口 ${clean} 已被「${conflict.name || '未命名'}」使用`
      }
    }

    setFrontendPortError(error)
    onSave(id, { frontendPort: clean })
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-w-0">
      {/* 服务配置 */}
      <Card>
        <CardHeader>
          <CardTitle>服务配置</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field>
            <FieldLabel>名称</FieldLabel>
            <FieldContent>
              <Input
                value={selected.name}
                onChange={(e) => onSave(selected.id, { name: e.target.value })}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder="服务名称"
                aria-invalid={!!fieldErrors.name || undefined}
              />
              <FieldError>{fieldErrors.name}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>项目目录</FieldLabel>
            <FieldContent>
              <Select
                value={selected.projectDir || null}
                onValueChange={(value) => {
                  onSave(selected.id, { projectDir: value ?? '' })
                  setTouched((prev) => ({ ...prev, projectDir: true }))
                }}
              >
                <SelectTrigger
                  className="w-full"
                  disabled={isRunning}
                  aria-invalid={!!fieldErrors.projectDir || undefined}
                >
                  <SelectValue placeholder="选择项目目录">
                    {selectedDir
                      ? selectedDir.name
                        ? `${selectedDir.name} (${selectedDir.path})`
                        : selectedDir.path
                      : selected.projectDir}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {projectDirs.map((dir) => (
                    <SelectItem key={dir.path} value={dir.path}>
                      {dir.name ? `${dir.name} (${dir.path})` : dir.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLocal && (
                <Link
                  href="/settings"
                  className="text-xs text-muted-foreground hover:text-foreground mt-0.5 inline-block"
                >
                  管理项目目录 →
                </Link>
              )}
              <FieldError>{fieldErrors.projectDir}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>后端地址</FieldLabel>
            <FieldContent>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>https://</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  className="border-0 ring-0 focus-visible:ring-0 shadow-none"
                  value={selected.backendHost.replace(/^https?:\/\//, '')}
                  onChange={(e) => handleBackendHostChange(selected.id, e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, backendHost: true }))}
                  placeholder="hostname.local"
                  disabled={isRunning}
                  aria-invalid={!!fieldErrors.backendHost || undefined}
                />
              </InputGroup>
              <FieldError>{fieldErrors.backendHost}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>后端端口</FieldLabel>
            <FieldContent>
              <Input
                value={selected.backendPort}
                onChange={(e) =>
                  onSave(selected.id, { backendPort: e.target.value.replace(/\D/g, '') })
                }
                onBlur={() => setTouched((prev) => ({ ...prev, backendPort: true }))}
                placeholder="80"
                disabled={isRunning}
                aria-invalid={!!fieldErrors.backendPort || undefined}
              />
              <FieldError>{fieldErrors.backendPort}</FieldError>
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel>前端端口</FieldLabel>
            <FieldContent>
              <Input
                value={selected.frontendPort}
                aria-invalid={!!fieldErrors.frontendPort || !!frontendPortError || undefined}
                onChange={(e) => handleFrontendPortChange(selected.id, e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, frontendPort: true }))}
                placeholder="80"
                disabled={isRunning}
              />
              <FieldError>{fieldErrors.frontendPort ?? frontendPortError}</FieldError>
            </FieldContent>
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
              删除此服务
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认删除</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要删除此服务吗？此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true)
                    await onDelete(selected.id)
                    setIsDeleting(false)
                    setDeleteOpen(false)
                  }}
                >
                  {isDeleting && <Spinner />}
                  删除
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      {/* 服务控制 */}
      <Card>
        <CardHeader>
          <CardTitle>服务控制</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button
            onClick={() => onServiceAction(selected.id, 'start')}
            disabled={busy?.id === selected.id || Object.values(fieldErrors).some(Boolean)}
          >
            {busy?.id === selected.id && busy?.action === 'start' ? <Spinner /> : '▶'} 启动
          </Button>
          <Button
            variant="secondary"
            onClick={() => onServiceAction(selected.id, 'stop')}
            disabled={busy?.id === selected.id}
          >
            {busy?.id === selected.id && busy?.action === 'stop' ? <Spinner /> : '■'} 停止
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {isRunning && selected.frontendPort ? (
            <a
              href={frontendUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-5 items-center gap-1 rounded-4xl border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground"
            >
              {frontendUrl ?? `:${selected.frontendPort}`}
            </a>
          ) : (
            <Badge variant="secondary">○ 已停止</Badge>
          )}
        </CardContent>
      </Card>

      {/* 运行日志 */}
      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>运行日志</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 min-h-0 w-full rounded-lg border bg-muted/30 p-3">
            <pre className="text-xs leading-relaxed font-mono">
              {(logs[selected.id] ?? []).length > 0
                ? (logs[selected.id] ?? []).map((line, i) => (
                    <div
                      key={i}
                      dangerouslySetInnerHTML={{
                        __html: anser.ansiToHtml(line, { use_classes: false })
                      }}
                    />
                  ))
                : '暂无日志'}
            </pre>
            <div ref={logEndRef} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
