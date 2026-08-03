'use client'

import { useEffect } from 'react'
import { toast } from '@/components/ui/toast'
import { useScheduleStore, type ScheduleState } from '@/lib/schedule-store'

// 保存当前提醒 toast 的 id 及其自动关闭定时器，供更新与清理使用（替代硬编码 id）
let reminderToastId: string | null = null
let reminderCloseTimer: ReturnType<typeof setTimeout> | null = null

// 到暂停时刻自动关闭 toast；重排前先清旧定时器。
// 若 toast 已被 effect 清空重建，检查 id 不匹配则不误关新 toast
function scheduleAutoClose(id: string, remaining: number) {
  if (reminderCloseTimer) clearTimeout(reminderCloseTimer)
  reminderCloseTimer = setTimeout(() => {
    if (reminderToastId === id) {
      toast.close(id)
      reminderToastId = null
    }
  }, remaining)
}

// 在暂停时刻弹提醒 toast，到暂停时刻自动关闭。
// 未跳过时初始显示「跳过」，已跳过时初始显示「还原」，跳过/还原都在同一条 toast 上切换
function showReminderToast(pauseTime: string, initialSkipped: boolean) {
  const { enabled, reminderEnabled, reminderMinutes } = useScheduleStore.getState()
  const [h, m] = pauseTime.split(':').map(Number)
  const pause = new Date()
  pause.setHours(h, m, 0, 0)
  const now = Date.now()
  const remaining = pause.getTime() - now
  // 配置关闭、暂停已过或不在提醒窗口（暂停前 reminderMinutes 分钟）内：不弹也不更新
  if (
    !enabled ||
    !reminderEnabled ||
    remaining <= 0 ||
    now < pause.getTime() - reminderMinutes * 60000
  )
    return

  // 跳过：请求中 loading，成功后更新同一条 toast 为「已跳过 + 还原」
  const handleSkip = async () => {
    if (reminderToastId) toast.update(reminderToastId, { type: 'loading' })
    try {
      await fetch('/api/service/skip-pause', { method: 'POST' })
      // 标记今天已跳过，抑制窗口内的重复提醒
      useScheduleStore.getState().skipToday()
      if (reminderToastId) {
        toast.update(reminderToastId, {
          type: 'info',
          title: '已跳过今天的暂停',
          actionProps: { children: '还原', onClick: handleRestore }
        })
      }
    } catch {
      if (reminderToastId) toast.update(reminderToastId, { type: 'error', title: '跳过失败' })
    }
  }

  // 还原：请求中 loading，成功后更新同一条 toast 回「服务将暂停 + 跳过」
  const handleRestore = async () => {
    if (reminderToastId) toast.update(reminderToastId, { type: 'loading' })
    try {
      await fetch('/api/service/unskip-pause', { method: 'POST' })
      useScheduleStore.getState().restoreToday()
      if (reminderToastId) {
        toast.update(reminderToastId, {
          type: 'loading',
          title: `服务将在 ${pauseTime} 暂停`,
          actionProps: { children: '跳过', onClick: handleSkip }
        })
      }
    } catch {
      if (reminderToastId) toast.update(reminderToastId, { type: 'error', title: '还原失败' })
    }
  }

  const title = initialSkipped ? '已跳过今天的暂停' : `服务将在 ${pauseTime} 暂停`
  const actionProps = initialSkipped
    ? { children: '还原', onClick: handleRestore }
    : { children: '跳过', onClick: handleSkip }

  if (reminderToastId) {
    // 已有 toast（pauseTime/skippedToday 变化）：更新标题与按钮，并重排自动关闭时刻
    toast.update(reminderToastId, {
      // 未跳过用 loading 图标（等待暂停中），已跳过用 info 图标区分
      type: initialSkipped ? 'info' : 'loading',
      title,
      actionProps
    })
    scheduleAutoClose(reminderToastId, remaining)
  } else {
    const id = toast.add({
      type: initialSkipped ? 'info' : 'loading',
      title,
      timeout: remaining,
      actionProps
    })
    reminderToastId = id
    // base-ui 对 loading 类型 toast 不自动关闭（add/update 均不启动 timer），需手动定时到暂停时刻关闭
    scheduleAutoClose(id, remaining)
  }
}

// 常驻提醒组件：挂在 root layout，所有页面共享全局暂停配置并在进入提醒窗口时弹 toast
export function ScheduleReminder({
  isWorkday,
  initialSkippedToday,
  schedule
}: {
  isWorkday: boolean
  initialSkippedToday: boolean
  schedule: Pick<ScheduleState, 'enabled' | 'pauseTime' | 'reminderEnabled' | 'reminderMinutes'>
}) {
  useEffect(() => {
    // 刷新时由 SSR 注入 initialSkippedToday，恢复客户端内存态；软导航期间 schedule 不变，保持当前会话状态
    useScheduleStore.getState().setSchedule({
      enabled: schedule.enabled,
      pauseTime: schedule.pauseTime,
      reminderEnabled: schedule.reminderEnabled,
      reminderMinutes: schedule.reminderMinutes,
      skippedToday: initialSkippedToday
    })
  }, [schedule, initialSkippedToday])

  const { enabled, pauseTime, reminderEnabled, reminderMinutes, skippedToday } = useScheduleStore()

  // const skippedTodayRef = useRef(skippedToday)

  // useEffect(() => {
  //   skippedTodayRef.current = skippedToday
  // }, [skippedToday])

  useEffect(() => {
    // 配置关闭或暂停时间缺失：清空残留 toast
    if (!enabled || !reminderEnabled || !pauseTime) {
      if (reminderToastId) {
        toast.close(reminderToastId)
        reminderToastId = null
      }
      return
    }
    if (!isWorkday) return

    const [h, m] = pauseTime.split(':').map(Number)
    const pause = new Date()
    pause.setHours(h, m, 0, 0)
    const now = Date.now()
    // 进入提醒窗口（暂停前 reminderMinutes 分钟内）才提醒，暂停已过则不提醒
    const inWindow = now < pause.getTime() && now >= pause.getTime() - reminderMinutes * 60000
    if (!inWindow) {
      // 窗口外：清空残留 toast
      if (reminderToastId) {
        toast.close(reminderToastId)
        reminderToastId = null
      }
      return
    }
    // 窗口内：已有 toast 则保持（跳过/还原在同一条上 update），无则按当前状态弹新
  }, [enabled, pauseTime, reminderEnabled, reminderMinutes, isWorkday])

  useEffect(() => {
    if (enabled && isWorkday) showReminderToast(pauseTime, skippedToday)
  }, [pauseTime, skippedToday, enabled, isWorkday])
  return null
}
