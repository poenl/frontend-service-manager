'use client'

import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import ProjectConfigsPanel from './project-configs-panel'
import SchedulePanel from './schedule-panel'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 max-w-lg mx-auto w-full">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            {/* 历史回退到来源页 */}
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回服务管理
            </button>
          </div>
          <CardTitle>全局设置</CardTitle>
        </CardHeader>
      </Card>

      <ProjectConfigsPanel />
      <SchedulePanel />
    </div>
  )
}
