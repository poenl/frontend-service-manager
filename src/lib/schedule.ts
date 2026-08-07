import { getSchedule, getSkipPauseDate, setSkipPauseDate, type ScheduleConfig } from '@/lib/config'
import { pauseAllServices, resumeAllServices } from '@/lib/service-process'
import { eventBus } from './service-events'
import { isWorkday } from './workday'

// 每日固定时刻触发一次的任务（仅支持 HH:MM 时间点）
class FixedTimeJob {
  private time: string
  private callback: () => void | Promise<void>
  private unref: boolean
  private _stopped = false
  private _timeout: ReturnType<typeof setTimeout> | null = null

  constructor(time: string, callback: () => void | Promise<void>, options?: { unref?: boolean }) {
    this.time = time
    this.callback = callback
    this.unref = options?.unref ?? false
    this.schedule()
  }

  // 距下一次触发时刻的毫秒数，当前时间已过则顺延到次日
  private nextDelay(): number {
    const [hour, minute] = this.time.split(':').map(Number)
    const next = new Date()
    next.setHours(hour, minute, 0, 0)
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1)
    return next.getTime() - Date.now()
  }

  private schedule() {
    if (this._stopped) return
    this._timeout = setTimeout(async () => {
      if (this._stopped) return

      try {
        await this.callback()
      } catch {
        /* swallow */
      }

      if (!this._stopped) this.schedule()
    }, this.nextDelay())

    if (this.unref && this._timeout) {
      this._timeout.unref()
    }
  }

  stop() {
    this._stopped = true
    if (this._timeout) {
      clearTimeout(this._timeout)
      this._timeout = null
    }
  }
}

let pauseJob: FixedTimeJob | null = null
let resumeJob: FixedTimeJob | null = null
let reminderJob: FixedTimeJob | null = null

// 后端下发的提醒状态：前端据此弹/关提醒 toast，所有客户端经 SSE 同步
export interface ReminderState {
  inWindow: boolean
  skippedToday: boolean
  isWorkday: boolean
  enabled: boolean
  pauseTime: string
  reminderEnabled: boolean
  reminderMinutes: number
}

// 当天日期字符串（YYYY-MM-DD），用于判断「跳过今天」
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

// 计算当前提醒状态（是否在提醒窗口内、当天是否跳过、是否工作日等）
export async function computeReminderState(): Promise<ReminderState> {
  const cfg = getSchedule()
  const [h, m] = cfg.pauseTime.split(':').map(Number)
  const pause = new Date()
  pause.setHours(h, m, 0, 0)
  const now = Date.now()
  return {
    inWindow: now >= pause.getTime() - cfg.reminderMinutes * 60000 && now < pause.getTime(),
    skippedToday: getSkipPauseDate() === todayStr(),
    isWorkday: await isWorkday(new Date()),
    enabled: cfg.enabled,
    pauseTime: cfg.pauseTime,
    reminderEnabled: cfg.reminderEnabled,
    reminderMinutes: cfg.reminderMinutes
  }
}

// 计算并向所有 SSE 客户端广播最新提醒状态
export async function broadcastReminder() {
  eventBus.emit('reminder', await computeReminderState())
}

async function onPause() {
  // 当天已跳过则清除标记并跳过本次暂停，不影响后续日期
  if (getSkipPauseDate() === todayStr()) {
    setSkipPauseDate(undefined)
    await broadcastReminder()
    return
  }

  if (!(await isWorkday(new Date()))) {
    await broadcastReminder()
    return
  }

  await pauseAllServices()
  await broadcastReminder()
}

async function onResume() {
  if (!(await isWorkday(new Date()))) {
    await broadcastReminder()
    return
  }

  await resumeAllServices()
  await broadcastReminder()
}

function buildJobs(cfg: ScheduleConfig) {
  pauseJob?.stop()
  resumeJob?.stop()
  reminderJob?.stop()
  pauseJob = null
  resumeJob = null
  reminderJob = null

  if (!cfg.enabled) return

  pauseJob = new FixedTimeJob(cfg.pauseTime, onPause, { unref: true })

  // 提醒窗口开始时刻 = 暂停时刻 - 提前分钟，进入窗口时广播一次；
  // 跨天（暂停时刻距 0 点不足提前量）时窗口开始落在前一天，FixedTimeJob 表达不了，不创建
  const [ph, pm] = cfg.pauseTime.split(':').map(Number)
  const windowStartMin = ph * 60 + pm - cfg.reminderMinutes
  if (cfg.reminderEnabled && windowStartMin >= 0) {
    const startTime = `${String(Math.floor(windowStartMin / 60)).padStart(2, '0')}:${String(
      windowStartMin % 60
    ).padStart(2, '0')}`
    reminderJob = new FixedTimeJob(startTime, () => broadcastReminder(), { unref: true })
  }

  if (cfg.autoResume) {
    resumeJob = new FixedTimeJob(cfg.resumeTime, onResume, { unref: true })
  }
}

export async function skipPause() {
  setSkipPauseDate(todayStr())
  await broadcastReminder()
}

// 还原：清除当天跳过标记，恢复今天的自动暂停
export async function unskipPause() {
  setSkipPauseDate(undefined)
  await broadcastReminder()
}

export function reloadSchedule() {
  buildJobs(getSchedule())
}

reloadSchedule()
