'use client'

import { toast } from '@/components/ui/toast'
import { useSSE } from '@/lib/use-sse'
import type { ReminderState } from '@/lib/schedule'

// 保存当前提醒 toast 的 id，供更新与清理使用（替代硬编码 id）
let reminderToastId: string | null = null

// 关闭当前提醒 toast 并置空
function closeReminderToast() {
  if (reminderToastId) {
    toast.close(reminderToastId)
    reminderToastId = null
  }
}

// 根据后端推送的提醒状态弹/更新/关闭 toast：
// 未跳过显示「服务将暂停 + 跳过」，已跳过显示「已跳过 + 还原」，不在窗口内则关闭
function handleReminder(state: ReminderState) {
  const shouldShow = state.inWindow && state.enabled && state.reminderEnabled && state.isWorkday
  if (!shouldShow) {
    closeReminderToast()
    return
  }

  // 跳过：请求中 loading，成功后更新同一条 toast 为「已跳过 + 还原」。
  // 后端会广播新状态，本页即时更新让反馈无延迟，其他标签页经广播同步
  const handleSkip = async () => {
    if (reminderToastId) toast.update(reminderToastId, { type: 'loading' })
    try {
      await fetch('/api/service/skip-pause', { method: 'POST' })
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
      if (reminderToastId) {
        toast.update(reminderToastId, {
          type: 'loading',
          title: `服务将在 ${state.pauseTime} 暂停`,
          actionProps: { children: '跳过', onClick: handleSkip }
        })
      }
    } catch {
      if (reminderToastId) toast.update(reminderToastId, { type: 'error', title: '还原失败' })
    }
  }

  const title = state.skippedToday ? '已跳过今天的暂停' : `服务将在 ${state.pauseTime} 暂停`
  const actionProps = state.skippedToday
    ? { children: '还原', onClick: handleRestore }
    : { children: '跳过', onClick: handleSkip }

  if (reminderToastId) {
    // 状态变化（如 skippedToday 变化）：更新同一条 toast
    toast.update(reminderToastId, {
      // 未跳过用 loading 图标（等待暂停中），已跳过用 info 图标区分
      type: state.skippedToday ? 'info' : 'loading',
      title,
      actionProps
    })
  } else {
    reminderToastId = toast.add({
      // 显式声明 low 优先级：作为后台提醒礼貌通知，不打断用户当前操作（base-ui 默认即 low）
      priority: 'low',
      type: state.skippedToday ? 'info' : 'loading',
      title,
      actionProps
    })
  }
}

// 常驻提醒组件：挂在 root layout，由后端经 SSE 推送提醒状态驱动，前端无需任何定时器
export function ScheduleReminder() {
  useSSE<ReminderState>('reminder', handleReminder)
  return null
}
