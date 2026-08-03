import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import ProjectDirsPanel from './project-dirs-panel'
import SchedulePanel from './schedule-panel'

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 max-w-lg mx-auto w-full">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回服务管理
            </Link>
          </div>
          <CardTitle>全局设置</CardTitle>
        </CardHeader>
      </Card>

      <ProjectDirsPanel />
      <SchedulePanel />
    </div>
  )
}
