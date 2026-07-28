'use client'

import { createContext, useContext } from 'react'
import { createStore, useStore } from 'zustand'
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
}

export type ServiceStore = ReturnType<typeof createServiceStore>

export function createServiceStore(initial: ServiceInitialData) {
  return createStore<ServiceState>()(() => ({
    services: initial.services ?? [],
    projectDirs: initial.projectDirs ?? [],
    running: initial.running ?? {},
    logs: initial.logs ?? {},
    pausedCount: initial.pausedCount ?? 0,
    isLocal: initial.isLocal ?? false,
    hostname: initial.hostname ?? ''
  }))
}

let _subscribed = false

export function subscribeSSE(store: ServiceStore) {
  if (typeof window === 'undefined') return
  if (_subscribed) return
  _subscribed = true

  sseClient.on('snapshot', (data: unknown) => {
    const snapshot = data as { id: string; running: boolean }[]
    store.setState((s) => {
      const running = { ...s.running }
      for (const svc of snapshot) running[svc.id] = svc.running
      return { running }
    })
  })

  sseClient.on('status', (data: unknown) => {
    const { id, running: isRunning } = data as { id: string; running: boolean }
    store.setState((s) => {
      const logs = isRunning ? { ...s.logs, [id]: [] } : s.logs
      return { running: { ...s.running, [id]: isRunning }, logs }
    })
  })

  sseClient.on('log', (data: unknown) => {
    const { id, line } = data as { id: string; line: string }
    store.setState((s) => {
      const current = s.logs[id] ?? []
      return { logs: { ...s.logs, [id]: [...current, line] } }
    })
  })

  sseClient.on('paused', (data: unknown) => {
    const { pausedCount } = data as { pausedCount: number }
    store.setState({ pausedCount })
  })

  sseClient.on('services', (data: unknown) => {
    store.setState({ services: data as ServiceConfig[] })
  })

  sseClient.on('project-dirs', (data: unknown) => {
    store.setState({ projectDirs: data as ProjectDir[] })
  })
}

export const ServiceStoreContext = createContext<ServiceStore | null>(null)

export function useServiceStore<Sel>(selector: (state: ServiceState) => Sel): Sel {
  const store = useContext(ServiceStoreContext)
  if (!store) throw new Error('useServiceStore must be used within ServiceStoreProvider')
  return useStore(store, selector)
}
