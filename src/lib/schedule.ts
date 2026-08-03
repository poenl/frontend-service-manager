import { getSchedule, getSkipPauseDate, setSkipPauseDate, type ScheduleConfig } from '@/lib/config'
import { pauseAllServices, resumeAllServices } from '@/lib/service-process'
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

// 当天日期字符串（YYYY-MM-DD），用于判断「跳过今天」
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

async function onPause() {
  // 当天已跳过则清除标记并跳过本次暂停，不影响后续日期
  if (getSkipPauseDate() === todayStr()) {
    setSkipPauseDate(undefined)
    return
  }

  if (!(await isWorkday(new Date()))) return

  await pauseAllServices()
}

async function onResume() {
  if (!(await isWorkday(new Date()))) return

  await resumeAllServices()
}

function buildJobs(cfg: ScheduleConfig) {
  pauseJob?.stop()
  resumeJob?.stop()
  pauseJob = null
  resumeJob = null

  if (!cfg.enabled) return

  pauseJob = new FixedTimeJob(cfg.pauseTime, onPause, { unref: true })

  if (cfg.autoResume) {
    resumeJob = new FixedTimeJob(cfg.resumeTime, onResume, { unref: true })
  }
}

export function skipPause() {
  setSkipPauseDate(todayStr())
}

// 还原：清除当天跳过标记，恢复今天的自动暂停
export function unskipPause() {
  setSkipPauseDate(undefined)
}

// 今天是否已跳过自动暂停（供 SSR 注入，刷新后恢复客户端状态）
export function isSkipPauseActive(): boolean {
  return getSkipPauseDate() === todayStr()
}

export function reloadSchedule() {
  buildJobs(getSchedule())
}

reloadSchedule()
