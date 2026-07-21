'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ServiceList from '@/app/service-list'
import ServiceDetailPanel from '@/app/service-detail-panel'
import { useServiceManager } from '@/lib/use-service-manager'
import type { ServiceConfig, ProjectDir } from '@/lib/config'

/**
 * 服务详情页面客户端组件：左侧服务列表 + 右侧详情面板
 */
export default function ServiceDetailPage({
  selectedId,
  initialServices,
  initialProjectDirs,
  initialRunning = {},
  initialLogs = {},
  initialPausedCount = 0,
  initialIsLocal: isLocal = false,
  initialHostname = ''
}: {
  selectedId: string
  initialServices: ServiceConfig[]
  initialProjectDirs: ProjectDir[]
  initialRunning?: Record<string, boolean>
  initialLogs?: Record<string, string[]>
  initialPausedCount?: number
  initialIsLocal?: boolean
  initialHostname?: string
}) {
  const router = useRouter()
  const {
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
  } = useServiceManager({
    initialServices,
    initialProjectDirs,
    initialRunning,
    initialLogs,
    initialPausedCount
  })

  // 当当前选中的服务被删除时，跳转回首页
  useEffect(() => {
    if (services.length > 0 && !services.find((s) => s.id === selectedId)) {
      router.push('/')
    }
  }, [services, selectedId, router])

  const selected = services.find((s) => s.id === selectedId)

  const handleAdd = async () => {
    const id = await addService()
    if (id) router.push('/service/' + id)
  }

  const handleDelete = async (id: string) => {
    const ok = await deleteService(id)
    if (ok) router.push('/')
    return ok
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
        onSelect={(id) => router.push('/service/' + id)}
        onAdd={handleAdd}
        onPauseAll={handlePauseAll}
        onResumeAll={handleResumeAll}
      />
      {selected ? (
        <ServiceDetailPanel
          services={services}
          selectedId={selectedId}
          running={running}
          logs={logs}
          projectDirs={projectDirs}
          hostname={initialHostname}
          busy={busy}
          logEndRef={logEndRef}
          isLocal={isLocal}
          onSave={saveService}
          onDelete={handleDelete}
          onServiceAction={handleServiceAction}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          加载中...
        </div>
      )}
    </div>
  )
}
