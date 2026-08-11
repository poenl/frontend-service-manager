'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  InputGroup,
  InputGroupText,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton
} from '@/components/ui/input-group'
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
import { Play, Square, Circle, Dices } from 'lucide-react'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import { useServiceStore, setOperating, getServiceStore } from '@/lib/service-store'
import type { ServiceConfig } from '@/lib/config'
import { openServiceTab } from '@/lib/open-service-tab'
import * as api from '@/lib/service-api'
import LogViewer from './log-viewer'

export default function ServiceDetailPanel() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const selectedId = params?.id ?? ''

  const services = useServiceStore((s) => s.services)
  const projectDirs = useServiceStore((s) => s.projectDirs)
  const running = useServiceStore((s) => s.running)
  const logs = useServiceStore((s) => s.logs)
  const hostname = useServiceStore((s) => s.hostname)
  const isLocal = useServiceStore((s) => s.isLocal)
  const operating = useServiceStore((s) => s.operating)

  const [frontendPortError, setFrontendPortError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [randomPortBusy, setRandomPortBusy] = useState(false)

  const selected = services.find((s) => s.id === selectedId)
  const frontendUrl = useFrontendUrl(selected?.frontendPort, !!running[selectedId], hostname)

  if (!selected) return null

  const selectedDir = projectDirs.find((p) => p.path === selected.projectDir)
  const isRunning = !!running[selectedId]

  // 乐观更新：先写本地 store，受控 value 即时反映，避免中文输入法组合被打断
  const optimisticPatch = (id: string, patch: Partial<ServiceConfig>) => {
    getServiceStore({}).setState((s) => ({
      services: s.services.map((svc) => (svc.id === id ? { ...svc, ...patch } : svc))
    }))
  }

  const fieldErrors = {
    name: touched.name && !selected.name ? '请输入服务名称' : null,
    projectDir: touched.projectDir && !selected.projectDir ? '请输入项目目录' : null,
    backendHost: touched.backendHost && !selected.backendHost ? '请输入后端地址' : null,
    backendPort: touched.backendPort && !selected.backendPort ? '请输入后端端口' : null,
    frontendPort: touched.frontendPort && !selected.frontendPort ? '请输入前端端口' : null
  }

  const handleBackendHostChange = (id: string, value: string) => {
    const raw = value.replace(/^https?:\/\//, '')
    const match = raw.match(/^(.+?):(\d+)$/)
    const patch: Record<string, string> = { backendHost: raw }
    if (match) {
      patch.backendHost = match[1]
      patch.backendPort = match[2]
    }
    optimisticPatch(id, patch)
    api.updateService(id, patch)
  }

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
    optimisticPatch(id, { frontendPort: clean })
    api.updateService(id, { frontendPort: clean })
  }

  // 随机端口：后端校验（避开本服务管理器端口、已配置服务端口与系统占用端口）
  const handleRandomPort = async (id: string) => {
    setRandomPortBusy(true)
    try {
      const { port } = await api.fetchRandomPort()
      setFrontendPortError(null)
      optimisticPatch(id, { frontendPort: String(port) })
      api.updateService(id, { frontendPort: String(port) })
    } catch {
      /* request() 已 toast 错误 */
    } finally {
      setRandomPortBusy(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.removeService(selected.id)
      router.push('/')
    } catch {
      /* ignore */
    } finally {
      setIsDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleServiceAction = async (id: string, action: 'start' | 'stop') => {
    if (action === 'stop' && !running[id]) return
    setOperating({ id, action })
    try {
      await api.operateService(id, action)
    } catch {
      /* ignore */
    } finally {
      setOperating(null)
    }
  }

  return (
    <div className="h-full flex-1 flex flex-col gap-4 min-w-0">
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
                onChange={(e) => {
                  optimisticPatch(selected.id, { name: e.target.value })
                  api.updateService(selected.id, { name: e.target.value })
                }}
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
                  optimisticPatch(selected.id, { projectDir: value ?? '' })
                  api.updateService(selected.id, { projectDir: value ?? '' })
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
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  optimisticPatch(selected.id, { backendPort: value })
                  api.updateService(selected.id, { backendPort: value })
                }}
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
              <InputGroup>
                <InputGroupInput
                  value={selected.frontendPort}
                  aria-invalid={!!fieldErrors.frontendPort || !!frontendPortError || undefined}
                  onChange={(e) => handleFrontendPortChange(selected.id, e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, frontendPort: true }))}
                  placeholder="80"
                  disabled={isRunning}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    onClick={() => handleRandomPort(selected.id)}
                    disabled={isRunning || randomPortBusy}
                  >
                    {randomPortBusy ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Dices className="size-3.5" />
                    )}
                    随机
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
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
                <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
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
            onClick={() => handleServiceAction(selected.id, 'start')}
            disabled={
              operating?.id === selected.id || isRunning || Object.values(fieldErrors).some(Boolean)
            }
          >
            {operating?.id === selected.id && operating?.action === 'start' ? (
              <Spinner />
            ) : (
              <Play className="size-4" />
            )}{' '}
            启动
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleServiceAction(selected.id, 'stop')}
            disabled={operating?.id === selected.id || !isRunning}
          >
            {operating?.id === selected.id && operating?.action === 'stop' ? (
              <Spinner />
            ) : (
              <Square className="size-4" />
            )}{' '}
            停止
          </Button>
          <Separator orientation="vertical" className="h-6" />
          {isRunning && selected.frontendPort ? (
            <a
              href={frontendUrl ?? '#'}
              className="inline-flex h-5 items-center gap-1 rounded-4xl border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground"
              onClick={(e) => {
                // 已打开的标签页复用聚焦，不新开不刷新；preventDefault 避免默认 _blank 导航
                e.preventDefault()
                openServiceTab(selected.id, frontendUrl!)
              }}
            >
              {frontendUrl ?? `:${selected.frontendPort}`}
            </a>
          ) : (
            <Badge variant="secondary">
              <Circle className="size-3" /> 已停止
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* 运行日志 */}
      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>运行日志</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <LogViewer lines={logs[selected.id] ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
