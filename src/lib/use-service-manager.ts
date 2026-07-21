'use client'

import { useState, useEffect, useRef } from 'react'
import { sseClient } from '@/lib/sse-client'
import { useSSE } from '@/lib/use-sse'
import {
  createService,
  updateService,
  removeService,
  operateService as apiOperateService,
  pauseAllServices as apiPauseAll,
  resumeAllServices as apiResumeAll
} from '@/lib/service-api'
import { toast } from 'sonner'
import { showNotification, requestPermission } from '@/lib/notification'
import type { ServiceConfig, ProjectDir } from '@/lib/config'

interface UseServiceManagerOptions {
  initialServices: ServiceConfig[]
  initialProjectDirs?: ProjectDir[]
  initialRunning?: Record<string, boolean>
  initialLogs?: Record<string, string[]>
  initialPausedCount?: number
}

/**
 * 共享 hook：管理服务列表、运行状态、日志及所有 CRUD/操作
 * 每个路由页面各自维护独立的 SSE 连接和状态
 */
export function useServiceManager({
  initialServices,
  initialProjectDirs = [],
  initialRunning = {},
  initialLogs = {},
  initialPausedCount = 0
}: UseServiceManagerOptions) {
  const [services, setServices] = useState<ServiceConfig[]>(initialServices)
  const [projectDirs, setProjectDirs] = useState<ProjectDir[]>(initialProjectDirs)
  const [running, setRunning] = useState<Record<string, boolean>>(initialRunning)
  const [logs, setLogs] = useState<Record<string, string[]>>(initialLogs)
  const [pausedCount, setPausedCount] = useState(initialPausedCount)
  const [busy, setBusy] = useState<{ id: string; action: 'start' | 'stop' } | null>(null)
  const [globalBusy, setGlobalBusy] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  // SSE 连接
  useEffect(() => {
    sseClient.connect()
    requestPermission() // 静默请求通知权限，浏览器对重复请求不会弹窗
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

    const service = services.find((s) => s.id === id)
    if (service?.name) {
      showNotification(isRunning ? '服务已启动' : '服务已停止', {
        body: service.name
      })
    }
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

  useSSE('services', (data: ServiceConfig[]) => {
    setServices(data)
  })

  useSSE('project-dirs', (data: ProjectDir[]) => {
    setProjectDirs(data)
  })

  // 自动滚动日志到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

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
      return svc.id
    } catch {
      toast.error('添加服务失败')
      return null
    }
  }

  const saveService = async (id: string, patch: Partial<ServiceConfig>) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
    try {
      await updateService(id, patch)
    } catch {
      toast.error('保存服务失败')
    }
  }

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
      return true
    } catch {
      toast.error('删除服务失败')
      return false
    }
  }

  const handleServiceAction = async (id: string, action: 'start' | 'stop') => {
    if (action === 'stop' && !running[id]) return
    setBusy({ id, action })
    try {
      const result = await apiOperateService(id, action)
      if (!result.success) {
        toast.error(result.message)
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
      if (result.success) toast.success(result.message)
      else toast.error(result.message)
    } catch {
      toast.error('恢复操作失败')
    } finally {
      setGlobalBusy(false)
    }
  }

  return {
    services,
    projectDirs,
    running,
    logs,
    pausedCount,
    busy,
    globalBusy,
    logEndRef,
    addService,
    saveService,
    deleteService,
    handleServiceAction,
    handlePauseAll,
    handleResumeAll
  }
}
