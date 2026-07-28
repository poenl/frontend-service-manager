'use client'

import { useState } from 'react'
import { Settings, Pause, Play, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import { useServiceStore } from '@/lib/service-store'
import { createService, pauseAllServices, resumeAllServices } from '@/lib/service-api'

function ServiceItem({
  id,
  name,
  backendPort,
  frontendPort,
  selected
}: {
  id: string
  name: string
  backendPort: string
  frontendPort: string
  selected: boolean
}) {
  const router = useRouter()
  const running = useServiceStore((s) => s.running)
  const hostname = useServiceStore((s) => s.hostname)
  const url = useFrontendUrl(frontendPort, !!running[id], hostname)

  return (
    <button
      type="button"
      onClick={() => router.push('/service/' + id)}
      data-selected={selected || undefined}
      className="relative flex items-center justify-between w-full rounded-lg px-3 py-2 overflow-hidden text-left text-sm transition-colors hover:bg-muted data-selected:bg-muted data-selected:font-bold group"
    >
      <span className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-muted-foreground/20 pointer-events-none select-none">
        {backendPort ? `:${backendPort}` : ''}
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        <span className="flex-1 truncate font-medium group-data-selected:font-bold">
          {name || '未命名服务'}
        </span>
      </div>
      <Badge
        variant={running[id] ? 'default' : 'secondary'}
        className="shrink-0 cursor-pointer"
        onClick={
          url
            ? (e) => {
                e.stopPropagation()
                window.open(url, '_blank')
              }
            : undefined
        }
      >
        {running[id] ? '运行中' : '已停止'}
        {running[id] && frontendPort ? <ArrowUpRight className="size-3 ml-0.5" /> : null}
      </Badge>
    </button>
  )
}

export default function ServiceList() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const selectedId = params?.id ?? ''

  const services = useServiceStore((s) => s.services)
  const running = useServiceStore((s) => s.running)
  const pausedCount = useServiceStore((s) => s.pausedCount)
  const isLocal = useServiceStore((s) => s.isLocal)

  const [globalBusy, setGlobalBusy] = useState(false)

  const hasRunning = Object.values(running).some(Boolean)

  const handleAdd = async () => {
    try {
      const svc = await createService({
        name: '',
        projectDir: '',
        backendHost: '',
        backendPort: '',
        frontendPort: ''
      })
      if (svc) router.push('/service/' + svc.id)
    } catch {
      /* ignore */
    }
  }

  const handlePauseAll = async () => {
    setGlobalBusy(true)
    try {
      await pauseAllServices()
    } catch {
      /* ignore */
    } finally {
      setGlobalBusy(false)
    }
  }

  const handleResumeAll = async () => {
    setGlobalBusy(true)
    try {
      await resumeAllServices()
    } catch {
      /* ignore */
    } finally {
      setGlobalBusy(false)
    }
  }

  return (
    <Card className="w-72 shrink-0 h-full">
      <CardHeader>
        <CardTitle>服务列表</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 flex-1">
        <ScrollArea>
          <div className="flex flex-col gap-1.5">
            {services.map((s) => (
              <ServiceItem
                key={s.id}
                id={s.id}
                name={s.name}
                backendPort={s.backendPort}
                frontendPort={s.frontendPort}
                selected={s.id === selectedId}
              />
            ))}
          </div>
        </ScrollArea>
        <Button onClick={handleAdd} variant="outline" className="w-full mt-2">
          + 添加服务
        </Button>
        <div className="flex gap-2 mt-auto">
          <Button
            onClick={handlePauseAll}
            variant="outline"
            className="flex-1"
            disabled={!hasRunning || globalBusy}
          >
            <Pause className="size-3.5 mr-1" /> 暂停
          </Button>
          <Button
            onClick={handleResumeAll}
            variant="outline"
            className="flex-1"
            disabled={pausedCount === 0 || globalBusy}
          >
            <Play className="size-3.5 mr-1" /> 恢复
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        {isLocal ? (
          <Link
            href="/settings"
            className="flex justify-center items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Settings className="size-4" /> 全局设置
          </Link>
        ) : (
          <span className="flex justify-center items-center gap-2 w-full rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed">
            <Settings className="size-4" /> 全局设置
          </span>
        )}
      </CardFooter>
    </Card>
  )
}
