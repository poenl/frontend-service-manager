'use client'

import { create } from 'zustand'

export interface ScheduleState {
  enabled: boolean
  pauseTime: string
  reminderEnabled: boolean
  reminderMinutes: number
  skippedToday: boolean
}

// 全局暂停配置状态：所有页面共享，settings 保存后通过 setSchedule 更新
export const useScheduleStore = create<
  ScheduleState & {
    setSchedule: (s: Partial<ScheduleState>) => void
    skipToday: () => void
    restoreToday: () => void
  }
>((set) => ({
  enabled: false,
  pauseTime: '',
  reminderEnabled: false,
  reminderMinutes: 30,
  skippedToday: false,
  setSchedule: (s) => set(s),
  skipToday: () => set({ skippedToday: true }),
  restoreToday: () => set({ skippedToday: false })
}))
