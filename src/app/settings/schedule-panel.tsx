'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toast'
import { fetchSchedule, updateSchedule } from '@/lib/settings-api'
import { useScheduleStore } from '@/lib/schedule-store'
import type { ScheduleConfig } from '@/lib/config'

const DEFAULT_SCHEDULE: ScheduleConfig = {
  enabled: false,
  pauseTime: '18:00',
  resumeTime: '09:00',
  autoResume: true,
  reminderEnabled: false,
  reminderMinutes: 30
}

export default function SchedulePanel() {
  const [schedule, setSchedule] = useState<ScheduleConfig>(DEFAULT_SCHEDULE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await fetchSchedule()
        setSchedule(data)
      } catch {
        // 错误提示已由 request 工具统一处理
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleScheduleSave = async () => {
    try {
      const updated = await updateSchedule(schedule)
      setSchedule(updated)
      // 更新全局暂停配置，让所有页面的提醒立即按新配置评估
      useScheduleStore.getState().setSchedule({
        enabled: updated.enabled,
        pauseTime: updated.pauseTime,
        reminderEnabled: updated.reminderEnabled,
        reminderMinutes: updated.reminderMinutes
      })
      // 配置更改即重新评估今天，同会话内还原跳过状态
      useScheduleStore.getState().restoreToday()
      // 确保保存成功显示在暂停提醒之前
      setTimeout(() => {
        toast.add({ type: 'success', title: '定时暂停设置已保存' })
      }, 0)
    } catch {
      // 错误提示已由 request 工具统一处理
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">加载中...</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="schedule-enabled"
            checked={schedule.enabled}
            onChange={(e) => setSchedule((s) => ({ ...s, enabled: e.target.checked }))}
            className="size-4"
          />
          <Label htmlFor="schedule-enabled">启用定时暂停</Label>
        </div>

        {schedule.enabled && (
          <>
            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pause-time">暂停时间</Label>
                <input
                  id="pause-time"
                  type="time"
                  value={schedule.pauseTime}
                  onChange={(e) => setSchedule((s) => ({ ...s, pauseTime: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="resume-time">恢复时间</Label>
                <input
                  id="resume-time"
                  type="time"
                  value={schedule.resumeTime}
                  onChange={(e) => setSchedule((s) => ({ ...s, resumeTime: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-resume"
                checked={schedule.autoResume}
                onChange={(e) => setSchedule((s) => ({ ...s, autoResume: e.target.checked }))}
                className="size-4"
              />
              <Label htmlFor="auto-resume">自动恢复</Label>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reminder-enabled"
                checked={schedule.reminderEnabled}
                onChange={(e) => setSchedule((s) => ({ ...s, reminderEnabled: e.target.checked }))}
                className="size-4"
              />
              <Label htmlFor="reminder-enabled">暂停提醒</Label>
            </div>

            {schedule.reminderEnabled && (
              <div className="flex items-center gap-2">
                <Label htmlFor="reminder-minutes">提前</Label>
                <Input
                  id="reminder-minutes"
                  type="number"
                  min={1}
                  max={120}
                  value={schedule.reminderMinutes}
                  onChange={(e) =>
                    setSchedule((s) => ({
                      ...s,
                      reminderMinutes: Math.max(1, Number(e.target.value))
                    }))
                  }
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">分钟</span>
              </div>
            )}
          </>
        )}

        <Button onClick={handleScheduleSave} disabled={loading}>
          保存
        </Button>
      </CardContent>
    </Card>
  )
}
