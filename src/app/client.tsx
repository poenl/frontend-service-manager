'use client'

import { useState, useEffect, useRef } from 'react'
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
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  createService,
  updateService,
  removeService,
  operateService as apiOperateService,
  pauseAllServices as apiPauseAll,
  resumeAllServices as apiResumeAll
} from '@/lib/service-api'
import ServiceList from './service-list'
import { sseClient } from '@/lib/sse-client'
import { useSSE } from '@/lib/use-sse'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import type { ServiceConfig, ProjectDir } from '@/lib/config'

export default function HomeClient({
  initialServices,
  initialProjectDirs: projectDirs,
  initialRunning = {},
  initialLogs = {},
  initialPausedCount = 0,
  initialIsLocal: isLocal = false,
  initialHostname = ''
}: {
  initialServices: ServiceConfig[]
  initialProjectDirs: ProjectDir[]
  initialRunning?: Record<string, boolean>
  initialLogs?: Record<string, string[]>
  initialPausedCount?: number
  initialIsLocal?: boolean
  initialHostname?: string
}) {
  const [services, setServices] = useState<ServiceConfig[]>(initialServices)
  const [selectedId, setSelectedId] = useState(initialServices[0]?.id ?? '')
  const [running, setRunning] = useState<Record<string, boolean>>(initialRunning)
  const [logs, setLogs] = useState<Record<string, string[]>>(initialLogs)
  const [pausedCount, setPausedCount] = useState(initialPausedCount)
  const [busy, setBusy] = useState<{ id: string; action: 'start' | 'stop' } | null>(null)
  const [globalBusy, setGlobalBusy] = useState(false)

  const [frontendPortError, setFrontendPortError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const logEndRef = useRef<HTMLDivElement>(null)

  // SSE 连接
  useEffect(() => {
    sseClient.connect()
    return () => sseClient.disconnect()
  }, [])

  useSSE('snapshot', (snapshot: { id: string; running: boolean }[]) => {
    setRunning((prev) => {
      const next = { ...prev }
      for (const s of snapshot) next[s.id] = s.running
      return next
    })
  })

  useSSE('status', ({ id, running: isRunning }: { id: string; running: boolean }) => {
    setRunning((prev) => ({ ...prev, [id]: isRunning }))
    if (isRunning) setLogs((prev) => ({ ...prev, [id]: [] }))
  })

  useSSE('log', ({ id, line }: { id: string; line: string }) => {
    setLogs((prev) => {
      const current = prev[id] ?? []
      return { ...prev, [id]: [...current, line] }
    })
  })

  useSSE('paused', ({ pausedCount: count }: { pausedCount: number }) => {
    setPausedCount(count)
  })

  // 自动滚动日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const selected = services.find((s) => s.id === selectedId)
  const selectedDir = projectDirs.find((p) => p.path === selected?.projectDir)
  const isRunning = selectedId ? !!running[selectedId] : false

  const frontendUrl = useFrontendUrl(selected?.frontendPort, !!running[selectedId], initialHostname)

  const fieldErrors = selected
    ? {
        name: touched.name && !selected.name ? '请输入服务名称' : null,
        projectDir: touched.projectDir && !selected.projectDir ? '请输入项目目录' : null,
        backendHost: touched.backendHost && !selected.backendHost ? '请输入后端地址' : null,
        backendPort: touched.backendPort && !selected.backendPort ? '请输入后端端口' : null,
        frontendPort: touched.frontendPort && !selected.frontendPort ? '请输入前端端口' : null
      }
    : {}

  // 添加服务
  const addService = async () => {
    try {
      const svc = await createService({
        name: '',
        projectDir: '',
        backendHost: '',
        backendPort: '',
        frontendPort: ''
      })
      setServices((prev) => [...prev, svc])
      setSelectedId(svc.id)
      setTouched({})
    } catch {
      toast.error('添加服务失败')
    }
  }

  // 保存服务
  const saveService = async (id: string, patch: Partial<ServiceConfig>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try {
      await updateService(id, patch)
    } catch {
      toast.error('保存服务失败')
    }
  }

  // 后端地址输入处理：清洗 http:// 前缀，自动提取端口
  const handleBackendHostChange = (id: string, value: string) => {
    const raw = value.replace(/^https?:\/\//, '')
    const match = raw.match(/^(.+?):(\d+)$/)
    if (match) {
      saveService(id, { backendHost: match[1], backendPort: match[2] })
    } else {
      saveService(id, { backendHost: raw })
    }
  }

  // 名称输入处理
  const handleNameChange = (id: string, value: string) => {
    saveService(id, { name: value })
  }

  // 项目目录输入处理
  const handleProjectDirChange = (id: string, value: string) => {
    saveService(id, { projectDir: value })
  }

  // 后端端口输入处理：仅保留数字
  const handleBackendPortChange = (id: string, value: string) => {
    saveService(id, { backendPort: value.replace(/\D/g, '') })
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
    saveService(id, { frontendPort: clean })
  }

  // 删除服务
  const deleteService = async (id: string) => {
    try {
      await removeService(id)
      setServices((prev) => prev.filter((s) => s.id !== id))
      setRunning((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setLogs((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSelectedId((prev) => (prev === id ? '' : prev))
    } catch {
      toast.error('删除服务失败')
    }
  }

  // 启动 / 停止
  const handleServiceAction = async (action: 'start' | 'stop') => {
    if (!selectedId) return
    if (action === 'stop' && !running[selectedId]) return
    setBusy({ id: selectedId, action })
    try {
      const result = await apiOperateService(selectedId, action)

      if (!result.success) {
        toast.error(result.message)
        return
      }
    } catch {
      toast.error(`${action === 'start' ? '启动' : '停止'}失败`)
    } finally {
      setBusy(null)
    }
  }

  const handlePauseAll = async () => {
    setGlobalBusy(true)
    try {
      const result = await apiPauseAll()
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
    } catch {
      toast.error('暂停操作失败')
    } finally {
      setGlobalBusy(false)
    }
  }

  const handleResumeAll = async () => {
    setGlobalBusy(true)
    try {
      const result = await apiResumeAll()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('恢复操作失败')
    } finally {
      setGlobalBusy(false)
    }
  }

  return (
    <div className="flex flex-1 h-full gap-4 p-4">
      <ServiceList
        services={services}
        selectedId={selectedId}
        running={running}
        isLocal={isLocal}
        hostname={initialHostname}
        globalBusy={globalBusy}
        pausedCount={pausedCount}
        onSelect={(id) => {
          setSelectedId(id)
          setTouched({})
        }}
        onAdd={addService}
        onPauseAll={handlePauseAll}
        onResumeAll={handleResumeAll}
      />

      {/* 右侧面板 */}
      {selected ? (
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
                    onChange={(e) => handleNameChange(selected.id, e.target.value)}
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
                      handleProjectDirChange(selected.id, value ?? '')
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
                    onChange={(e) => handleBackendPortChange(selected.id, e.target.value)}
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
              <AlertDialog>
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
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => deleteService(selected.id)}
                    >
                      删除
                    </AlertDialogAction>
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
                onClick={() => handleServiceAction('start')}
                disabled={busy?.id === selected.id || Object.values(fieldErrors).some(Boolean)}
              >
                {busy?.id === selected.id && busy?.action === 'start' ? <Spinner /> : '▶'} 启动
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleServiceAction('stop')}
                disabled={busy?.id === selected.id}
              >
                {busy?.id === selected.id && busy?.action === 'stop' ? <Spinner /> : '■'} 停止
              </Button>
              <Separator orientation="vertical" className="h-6" />
              {isRunning && selected?.frontendPort ? (
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
                <pre className="text-xs leading-relaxed text-muted-foreground font-mono">
                  {(logs[selected.id] ?? []).length > 0
                    ? (logs[selected.id] ?? []).join('\n')
                    : '暂无日志'}
                </pre>
                <div ref={logEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {'暂无服务，点击左侧"+ 添加服务"创建'}
        </div>
      )}
    </div>
  )
}
