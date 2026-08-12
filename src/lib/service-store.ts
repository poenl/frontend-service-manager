'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import { createStore } from 'zustand'
import { sseClient } from './sse-client'
import type { ServiceConfig, ProjectDir } from './config'

export interface ServiceInitialData {
  services?: ServiceConfig[]
  projectDirs?: ProjectDir[]
  running?: Record<string, boolean>
  logs?: Record<string, string[]>
  pausedCount?: number
  isLocal?: boolean
  hostname?: string
}

export interface ServiceState {
  services: ServiceConfig[]
  projectDirs: ProjectDir[]
  running: Record<string, boolean>
  logs: Record<string, string[]>
  pausedCount: number
  isLocal: boolean
  hostname: string
  operating: { id: string; action: 'start' | 'stop' } | null
}

export type ServiceStore = ReturnType<typeof createServiceStore>

export function createServiceStore(state: ServiceState) {
  return createStore<ServiceState>()(() => state)
}

// initialData 派生为完整 ServiceState（不可变），供 SSR 渲染与 hydration 首帧使用
export function toServiceState(initial: ServiceInitialData): ServiceState {
  return {
    services: initial.services ?? [],
    projectDirs: initial.projectDirs ?? [],
    running: initial.running ?? {},
    logs: initial.logs ?? {},
    pausedCount: initial.pausedCount ?? 0,
    isLocal: initial.isLocal ?? false,
    hostname: initial.hostname ?? '',
    operating: null
  }
}

// store 单例：首次用 initialData 创建，之后跨导航复用，保证订阅常驻写入同一实例
let storeInstance: ServiceStore | null = null

export function getServiceStore(initial: ServiceInitialData): ServiceStore {
  if (!storeInstance) storeInstance = createServiceStore(toServiceState(initial))
  return storeInstance
}

// 设置操作中状态：列表右键菜单与详情页按钮共用，保证 loading 同步
export function setOperating(op: { id: string; action: 'start' | 'stop' } | null) {
  storeInstance?.setState({ operating: op })
}

// 拖拽排序乐观更新：本地写入新顺序，服务端确认后由 SSE 推送兜底覆盖
export function setServices(services: ServiceConfig[]) {
  storeInstance?.setState({ services })
}

let _subscribed = false

// 常驻订阅：回调闭包引用模块级 storeInstance，注册一次不注销
// 页面在 /settings 停留期间事件持续写入 store，跳回后无需重新订阅也不丢消息
export function subscribeSSE() {
  if (typeof window === 'undefined') return
  if (_subscribed) return
  _subscribed = true

  sseClient.on('snapshot', (data: unknown) => {
    // snapshot 携带完整服务端状态，整体替换而非合并，
    // 保证每次连接（含断线重连）后与服务端完全一致
    const { services, running, logs, pausedCount } = data as {
      services: ServiceConfig[]
      running: Record<string, boolean>
      logs: Record<string, string[]>
      pausedCount: number
    }
    storeInstance?.setState({ services, running, logs, pausedCount })
  })

  sseClient.on('status', (data: unknown) => {
    const { id, running: isRunning } = data as { id: string; running: boolean }
    storeInstance?.setState((s) => {
      const logs = isRunning ? { ...s.logs, [id]: [] } : s.logs
      return { running: { ...s.running, [id]: isRunning }, logs }
    })
  })

  sseClient.on('log', (data: unknown) => {
    const { id, line } = data as { id: string; line: string }
    storeInstance?.setState((s) => {
      const current = s.logs[id] ?? []
      return { logs: { ...s.logs, [id]: [...current, line] } }
    })
  })

  sseClient.on('paused', (data: unknown) => {
    const { pausedCount } = data as { pausedCount: number }
    storeInstance?.setState({ pausedCount })
  })

  sseClient.on('services', (data: unknown) => {
    storeInstance?.setState({ services: data as ServiceConfig[] })
  })
}

export const ServiceStoreContext = createContext<ServiceStore | null>(null)

// initialData 派生的不可变快照，供 SSR 渲染与 hydration 首帧匹配使用
export const ServerSnapshotContext = createContext<ServiceState | null>(null)

export function useServiceStore<Sel>(selector: (state: ServiceState) => Sel): Sel {
  const store = useContext(ServiceStoreContext)
  const server = useContext(ServerSnapshotContext)
  if (!store || !server) throw new Error('useServiceStore must be used within ServiceStoreProvider')
  // SSR 渲染与 hydration 首帧用 server 快照，与 server HTML 保持一致；
  // hydration 提交后切换实时 store，避免 SSE 实时数据污染首帧导致 hydration mismatch
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(server)
  )
}
