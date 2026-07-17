'use client'

import { Settings } from 'lucide-react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ServiceConfig } from '@/lib/config'

interface ServiceListProps {
  services: ServiceConfig[]
  selectedId: string
  running: Record<string, boolean>
  isLocal: boolean
  onSelect: (id: string) => void
  onAdd: () => void
}

export default function ServiceList({
  services,
  selectedId,
  running,
  isLocal,
  onSelect,
  onAdd
}: ServiceListProps) {
  return (
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
                onClick={() => onSelect(s.id)}
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
        <Button onClick={onAdd} variant="outline" className="w-full mt-2">
          + 添加服务
        </Button>
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
