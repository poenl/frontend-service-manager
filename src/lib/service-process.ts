import { spawn, execFile, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { getService } from '@/lib/config'
import { eventBus } from '@/lib/service-events'

interface ProcessEntry {
  proc: ChildProcess
  logs: string[]
  startTime: number
}

const _g = globalThis as { __processes?: Map<string, ProcessEntry>; __pausedServices?: Set<string> }
if (!_g.__processes) _g.__processes = new Map()
if (!_g.__pausedServices) _g.__pausedServices = new Set()
const processes = _g.__processes
const pausedServices = _g.__pausedServices

function detectPm(cwd: string): string {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npx'
}

const execFileAsync = promisify(execFile)

// 查找监听指定端口的进程 PID 列表（macOS/Linux 用 lsof，Windows 用 netstat）
async function findPidByPort(port: number): Promise<number[]> {
  try {
    if (platform() === 'win32') {
      const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp'])
      return String(stdout)
        .split('\n')
        .filter((line) => line.includes(`:${port}`) && line.includes('LISTENING'))
        .map((line) => Number(line.trim().split(/\s+/).pop()))
        .filter((pid) => !isNaN(pid) && pid > 0)
    }
    const { stdout } = await execFileAsync('lsof', ['-t', '-sTCP:LISTEN', `-i:${port}`])
    return String(stdout)
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => !isNaN(pid))
  } catch {
    return []
  }
}

// 端口是否被占用：存在监听该端口的进程即视为占用
// 导出供随机端口路由（/api/service/random-port）复用
export async function isPortInUse(port: number): Promise<boolean> {
  return (await findPidByPort(port)).length > 0
}

// 强杀指定 PID 列表，Windows 用 taskkill（连带子进程树），POSIX 用 SIGKILL
async function killPids(pids: number[]): Promise<void> {
  for (const pid of pids) {
    try {
      if (platform() === 'win32') {
        await execFileAsync('taskkill', ['/F', '/T', '/PID', String(pid)])
      } else {
        process.kill(pid, 'SIGKILL')
      }
    } catch {
      // 进程已退出则忽略
    }
  }
}

export async function startService(
  id: string
): Promise<{ success: boolean; message: string; status?: number }> {
  const config = getService(id)
  if (!config) return { success: false, message: '服务不存在', status: 404 }
  if (!config.projectDir) return { success: false, message: '请填写项目目录', status: 400 }
  if (!config.backendHost) return { success: false, message: '请填写后端地址', status: 400 }
  if (!config.backendPort) return { success: false, message: '请填写后端端口', status: 400 }
  if (!config.frontendPort) return { success: false, message: '请填写前端端口', status: 400 }
  if (await isPortInUse(parseInt(config.frontendPort, 10))) {
    return { success: false, message: `端口 ${config.frontendPort} 已被其他进程占用`, status: 409 }
  }
  if (processes.has(id)) {
    const existing = processes.get(id)!
    if (existing.proc.exitCode === null && existing.proc.signalCode === null)
      return { success: false, message: '服务已在运行', status: 409 }
    existing.logs.length = 0
    existing.startTime = Date.now()
  }

  const cwd = config.projectDir.replace(/^~(?=\/|$)/, homedir())
  if (!cwd || !existsSync(cwd)) return { success: false, message: '项目目录不存在', status: 422 }

  const pm = detectPm(cwd)
  const args = ['vite']
  args.push('--no-open')
  if (config.frontendPort) args.push('--port', config.frontendPort)

  const baseUrl =
    config.backendHost && config.backendPort
      ? `http://${config.backendHost}:${config.backendPort}`
      : undefined
  // 显式注入的环境变量为唯一来源，env 与日志前缀都由此派生，避免两者再次不一致
  const injected = {
    FORCE_COLOR: '1',
    NODE_ENV: 'development',
    ...(baseUrl ? { VITE_APP_BASE_URL: baseUrl } : {})
  }
  const env = { ...process.env, ...injected } as NodeJS.ProcessEnv
  const envPrefix =
    Object.entries(injected)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ') + ' '

  // ponytail: 仅支持 Vite，后续可按需扩展 webpack/dev-server 等
  const commandLine = `[${new Date().toLocaleTimeString()}] $ ${envPrefix}${pm} ${args.join(' ')}`
  const logs: string[] = [commandLine]

  // 启动期间 buffer 事件，resolve 成功后才 flush，确保客户端先收到 200 OK 再收到日志
  const logBuffer: string[] = [commandLine]
  let buffering = true

  function tryEmit(line: string) {
    if (buffering) logBuffer.push(line)
    else eventBus.emit('log', { id, line })
  }

  function tryEmitStatus(running: boolean) {
    if (!buffering) eventBus.emit('status', { id, running })
  }

  const child: ChildProcess = spawn(pm, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      const formatted = `[${new Date().toLocaleTimeString()}] ${line}`
      logs.push(formatted)
      tryEmit(formatted)
    }
  })

  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean)
    for (const line of lines) {
      const formatted = `[${new Date().toLocaleTimeString()}] ${line}`
      logs.push(formatted)
      tryEmit(formatted)
    }
  })

  child.on('exit', () => {
    const msg = `[${new Date().toLocaleTimeString()}] 进程已退出`
    logs.push(msg)
    tryEmit(msg)
    tryEmitStatus(false)
  })

  const result = await new Promise<{ success: boolean; message: string; status?: number }>(
    (resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, message: '启动超时（15s）', status: 504 })
      }, 15000)

      const onOutput = () => {
        clearTimeout(timeout)
        resolve({ success: true, message: '服务已启动' })
      }

      child.stdout?.once('data', onOutput)
      child.stderr?.once('data', onOutput)

      child.on('exit', (code) => {
        clearTimeout(timeout)
        resolve({ success: false, message: `进程异常退出 (code: ${code})`, status: 502 })
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        resolve({ success: false, message: `启动失败: ${err.message}`, status: 500 })
      })
    }
  )

  if (result.success) {
    const entry = processes.get(id)
    if (entry) {
      entry.proc = child
      entry.logs = logs
      entry.startTime = Date.now()
    } else {
      processes.set(id, { proc: child, logs, startTime: Date.now() })
    }
    // 先推 status（客户端据此清空旧日志），再 flush 启动日志
    eventBus.emit('status', { id, running: true })
    for (const line of logBuffer) eventBus.emit('log', { id, line })
    buffering = false
    // 暂停列表非空时手动启动任意服务，清空暂停状态
    if (pausedServices.size > 0) {
      pausedServices.clear()
      eventBus.emit('paused', { pausedCount: 0 })
    }
  }

  return result
}

export async function stopService(
  id: string
): Promise<{ success: boolean; message: string; status?: number }> {
  const entry = processes.get(id)
  if (!entry) return { success: false, message: '服务未在运行', status: 409 }

  const config = getService(id)
  const { proc } = entry

  // 先正常请求退出；包管理器 wrapper 是否会把信号传给 vite 子进程无法保证，
  // 因此后续还要靠端口兜底确保真正释放
  proc.kill('SIGTERM')

  await new Promise<void>((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) return resolve()

    const forceKill = setTimeout(() => {
      if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL')
    }, 3000)

    proc.once('exit', () => {
      clearTimeout(forceKill)
      resolve()
    })
  })

  // 端口兜底：无论进程树关系如何，只要前端端口仍被占用，就定位占用者并强杀
  const port = config?.frontendPort ? parseInt(config.frontendPort, 10) : null
  if (port) {
    for (let i = 0; i < 5; i++) {
      const pids = await findPidByPort(port)
      if (pids.length === 0) break
      await killPids(pids)
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  const msg = `[${new Date().toLocaleTimeString()}] 服务已停止`
  entry.logs.push(msg)
  eventBus.emit('log', { id, line: msg })
  eventBus.emit('status', { id, running: false })
  return { success: true, message: '服务已停止' }
}

export function getServiceStatus(id: string): {
  running: boolean
  pid?: number
  uptime?: number
} {
  const entry = processes.get(id)
  if (!entry || entry.proc.exitCode !== null || entry.proc.signalCode !== null) {
    return { running: false }
  }
  return {
    running: true,
    pid: entry.proc.pid,
    uptime: Date.now() - entry.startTime
  }
}

export function getServiceLogs(id: string, since = 0): { logs: string[] } {
  const entry = processes.get(id)
  if (!entry) return { logs: [] }
  return { logs: entry.logs.slice(since) }
}

export function getPausedCount(): number {
  return pausedServices.size
}

export async function pauseAllServices(): Promise<{
  success: boolean
  message: string
  pausedCount: number
}> {
  const ids: string[] = []
  for (const [id, entry] of processes) {
    if (entry.proc.exitCode === null && entry.proc.signalCode === null) {
      ids.push(id)
    }
  }
  if (ids.length === 0) return { success: true, message: '没有运行中的服务', pausedCount: 0 }

  pausedServices.clear()
  for (const id of ids) pausedServices.add(id)

  const results = await Promise.allSettled(ids.map((id) => stopService(id)))
  const failed = results.filter((r) => r.status === 'rejected').length
  eventBus.emit('paused', { pausedCount: pausedServices.size })
  const msg = failed
    ? `已暂停 ${ids.length - failed}/${ids.length} 个服务`
    : `已暂停 ${ids.length} 个服务`
  return { success: true, message: msg, pausedCount: pausedServices.size }
}

export async function resumeAllServices(): Promise<{
  success: boolean
  message: string
  resumedCount: number
}> {
  const ids = [...pausedServices]
  if (ids.length === 0) return { success: true, message: '没有可恢复的服务', resumedCount: 0 }

  const results = await Promise.allSettled(ids.map((id) => startService(id)))
  const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
  pausedServices.clear()
  eventBus.emit('paused', { pausedCount: 0 })
  return { success: true, message: `已恢复 ${succeeded}/${ids.length} 个服务`, resumedCount: 0 }
}

// 退出清理：daemon 进程被终止时兜底停掉所有运行中的服务，
// 否则 vite 子进程不会随父进程消亡而残留为孤儿进程（Node 不会自动清理子进程）
let cleanedUp = false
async function cleanupOnExit(signal?: NodeJS.Signals): Promise<void> {
  if (cleanedUp) return
  cleanedUp = true
  await Promise.allSettled([...processes.keys()].map((id) => stopService(id)))
  process.exit(signal === 'SIGINT' ? 130 : 0)
}
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    void cleanupOnExit(sig)
  })
}
