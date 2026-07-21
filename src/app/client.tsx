'use client'

import { useRouter } from 'next/navigation'
import ServiceList from './service-list'
import { useServiceManager } from '@/lib/use-service-manager'
import type { ServiceConfig, ProjectDir } from '@/lib/config'

export default function HomeClient({
  initialServices,
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
  const router = useRouter()
  const {
    services,
    running,
    pausedCount,
    globalBusy,
    addService,
    handlePauseAll,
    handleResumeAll
  } = useServiceManager({
    initialServices,
    initialRunning,
    initialLogs,
    initialPausedCount
  })

  const handleAdd = async () => {
    const id = await addService()
    if (id) router.push('/service/' + id)
  }

  return (
    <div className="flex flex-1 h-full gap-4 p-4">
      <ServiceList
        services={services}
        selectedId=""
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {'暂无服务，点击左侧"+ 添加服务"创建'}
      </div>
    </div>
  )
}
