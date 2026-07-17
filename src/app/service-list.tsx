'use client'

import { Settings, Pause, Play, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import type { ServiceConfig } from '@/lib/config'

interface ServiceListProps {
  services: ServiceConfig[]
  selectedId: string
  running: Record<string, boolean>
  isLocal: boolean
  globalBusy: boolean
  pausedCount: number
  onSelect: (id: string) => void
  onAdd: () => void
  onPauseAll: () => void
  onResumeAll: () => void
}

function ServiceItem({
  service,
  selectedId,
  running,
  onSelect
}: {
  service: ServiceConfig
  selectedId: string
  running: Record<string, boolean>
  onSelect: (id: string) => void
}) {
  const url = useFrontendUrl(service.frontendPort, !!running[service.id])

  return (
    <button
      type="button"
      onClick={() => onSelect(service.id)}
      data-selected={service.id === selectedId || undefined}
      className="relative flex items-center justify-between w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted data-selected:bg-muted"
    >
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-muted-foreground/30 pointer-events-none select-none">
        :{service.backendPort || ''}
      </span>
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
        <span className="flex-1 truncate font-medium">{service.name || '未命名服务'}</span>
      </div>
      <Badge
        variant={running[service.id] ? 'default' : 'secondary'}
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
        {running[service.id] ? '运行中' : '已停止'}
        {url ? <ArrowUpRight className="size-3 ml-0.5" /> : null}
      </Badge>
    </button>
  )
}

export default function ServiceList({
  services,
  selectedId,
  running,
  isLocal,
  globalBusy,
  pausedCount,
  onSelect,
  onAdd,
  onPauseAll,
  onResumeAll
}: ServiceListProps) {
  const hasRunning = Object.values(running).some(Boolean)

  return (
    <Card className="w-72 shrink-0 h-full">
      <CardHeader>
        <CardTitle>服务列表</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
          <div className="flex flex-col gap-1.5">
            {services.map((s) => (
              <ServiceItem
                key={s.id}
                service={s}
                selectedId={selectedId}
                running={running}
                onSelect={onSelect}
              />
            ))}
          </div>
        </ScrollArea>
        <Button onClick={onAdd} variant="outline" className="w-full mt-2">
          + 添加服务
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={onPauseAll}
            variant="outline"
            className="flex-1"
            disabled={!hasRunning || globalBusy}
          >
            <Pause className="size-3.5 mr-1" /> 暂停
          </Button>
          <Button
            onClick={onResumeAll}
            variant="outline"
            className="flex-1"
            disabled={pausedCount === 0 || globalBusy}
          >
            <Play className="size-3.5 mr-1" /> 恢复
          </Button>
        </div>
      </CardContent>
      <CardFooter className="mt-auto">
        <Link
          href={isLocal ? '/settings' : '#'}
          className={`flex justify-center items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
            isLocal ? 'hover:bg-muted' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Settings className="size-4" /> 全局设置
        </Link>
      </CardFooter>
    </Card>
  )
}
