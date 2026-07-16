'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  fetchServices,
  createService,
  updateService,
  removeService,
  operateService as apiOperateService,
  fetchServiceStatus,
  fetchServiceLogs
} from '@/lib/service-api'

interface ServiceConfig {
  id: string
  name: string
  projectDir: string
  backendHost: string
  backendPort: string
  frontendPort: string
}

export default function Home() {
  const [services, setServices] = useState<ServiceConfig[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [running, setRunning] = useState<Record<string, boolean>>({})
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<{ id: string; action: 'start' | 'stop' } | null>(null)

  const [frontendPortError, setFrontendPortError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const logEndRef = useRef<HTMLDivElement>(null)
  const sinceRef = useRef<Record<string, number>>({})

  const selected = services.find((s) => s.id === selectedId)

  const fieldErrors = selected
    ? {
        name: touched.name && !selected.name ? '请输入服务名称' : null,
        projectDir: touched.projectDir && !selected.projectDir ? '请输入项目目录' : null,
        backendHost: touched.backendHost && !selected.backendHost ? '请输入后端地址' : null,
        backendPort: touched.backendPort && !selected.backendPort ? '请输入后端端口' : null,
        frontendPort: touched.frontendPort && !selected.frontendPort ? '请输入前端端口' : null
      }
    : {}

  // 加载服务列表
  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchServices()
        setServices(data)
        if (data.length > 0) setSelectedId(data[0].id)
      } catch {
        toast.error('加载服务失败')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // 轮询状态
  useEffect(() => {
    if (!selectedId) return

    const fetchStatus = async () => {
      try {
        const data = await fetchServiceStatus(selectedId)
        setRunning((prev) => ({ ...prev, [selectedId]: data.running }))
      } catch {
        /* ignore */
      }
    }

    fetchStatus()
    const poll = setInterval(fetchStatus, 2000)
    return () => clearInterval(poll)
  }, [selectedId])

  // 轮询日志
  useEffect(() => {
    if (!selectedId) return

    const fetchLogs = async () => {
      try {
        const since = sinceRef.current[selectedId] ?? 0
        const data = await fetchServiceLogs(selectedId, since)
        if (data.logs.length > 0) {
          sinceRef.current[selectedId] = since + data.logs.length
          setLogs((prev) => ({
            ...prev,
            [selectedId]: [...(prev[selectedId] ?? []), ...data.logs]
          }))
        }
      } catch {
        /* ignore */
      }
    }

    fetchLogs()
    const poll = setInterval(fetchLogs, 1000)
    return () => clearInterval(poll)
  }, [selectedId])

  // 自动滚动日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 添加服务
  const addService = useCallback(async () => {
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
  }, [])

  // 保存服务
  const saveService = useCallback(async (id: string, patch: Partial<ServiceConfig>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try {
      await updateService(id, patch)
    } catch {
      toast.error('保存服务失败')
    }
  }, [])

  // 后端地址输入处理：清洗 http:// 前缀，自动提取端口
  const handleBackendHostChange = useCallback(
    (id: string, value: string) => {
      const raw = value.replace(/^https?:\/\//, '')
      const match = raw.match(/^(.+?):(\d+)$/)
      if (match) {
        saveService(id, { backendHost: match[1], backendPort: match[2] })
      } else {
        saveService(id, { backendHost: raw })
      }
    },
    [saveService]
  )

  // 名称输入处理
  const handleNameChange = useCallback(
    (id: string, value: string) => {
      saveService(id, { name: value })
    },
    [saveService]
  )

  // 项目目录输入处理
  const handleProjectDirChange = useCallback(
    (id: string, value: string) => {
      saveService(id, { projectDir: value })
    },
    [saveService]
  )

  // 后端端口输入处理：仅保留数字
  const handleBackendPortChange = useCallback(
    (id: string, value: string) => {
      saveService(id, { backendPort: value.replace(/\D/g, '') })
    },
    [saveService]
  )

  // 前端端口输入处理：禁止与本项目端口冲突，禁止与其他服务重复
  const handleFrontendPortChange = useCallback(
    (id: string, value: string) => {
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
    },
    [saveService, services]
  )

  // 删除服务
  const deleteService = useCallback(async (id: string) => {
    try {
      await removeService(id)
      setServices((prev) => prev.filter((s) => s.id !== id))
      setSelectedId((prev) => (prev === id ? '' : prev))
    } catch {
      toast.error('删除服务失败')
    }
  }, [])

  // 启动 / 停止
  const handleServiceAction = useCallback(
    async (action: 'start' | 'stop') => {
      if (!selectedId) return
      setBusy({ id: selectedId, action })
      try {
        const result = await apiOperateService(selectedId, action)

        if (!result.success) {
          toast.error(result.message)
          return
        }

        setRunning((prev) => ({ ...prev, [selectedId]: action === 'start' }))
        if (action === 'start') {
          sinceRef.current[selectedId] = 0
          setLogs((prev) => ({ ...prev, [selectedId]: [] }))
        }
      } catch {
        toast.error(`${action === 'start' ? '启动' : '停止'}失败`)
      } finally {
        setBusy(null)
      }
    },
    [selectedId]
  )

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">加载中...</div>
    )
  }

  return (
    <div className="flex flex-1 h-full gap-4 p-4">
      {/* 左侧服务列表 */}
      <Card className="w-64 shrink-0 h-full">
        <CardHeader>
          <CardTitle>服务列表</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
            <div className="flex flex-col gap-1.5">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(s.id)
                    setTouched({})
                  }}
                  data-selected={s.id === selectedId || undefined}
                  className="flex items-center justify-between w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted data-selected:bg-muted"
                >
                  <span className="truncate font-medium">{s.name || '未命名服务'}</span>
                  <Badge variant={running[s.id] ? 'default' : 'secondary'} className="shrink-0">
                    {running[s.id] ? '运行中' : '已停止'}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
          <Button onClick={addService} variant="outline" className="w-full mt-2">
            + 添加服务
          </Button>
        </CardContent>
      </Card>

      {/* 右侧面板 */}
      {selected ? (
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* 服务配置 */}
          <Card>
            <CardHeader>
              <CardTitle>服务配置</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field className="col-span-2">
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
              <Field className="col-span-2">
                <FieldLabel>项目目录</FieldLabel>
                <FieldContent>
                  <Input
                    value={selected.projectDir}
                    onChange={(e) => handleProjectDirChange(selected.id, e.target.value)}
                    onBlur={() => setTouched((prev) => ({ ...prev, projectDir: true }))}
                    placeholder="/path/to/project"
                    aria-invalid={!!fieldErrors.projectDir || undefined}
                  />
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
              {running[selected.id] && selected.frontendPort ? (
                <a
                  href={`http://${window.location.hostname}:${selected.frontendPort}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-5 items-center gap-1 rounded-4xl border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground"
                >
                  http://{window.location.hostname}:{selected.frontendPort}
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
