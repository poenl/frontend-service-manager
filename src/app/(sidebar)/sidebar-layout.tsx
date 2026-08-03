'use client'

import { useState, useEffect, type ReactNode } from 'react'
import {
  ServiceStoreContext,
  ServerSnapshotContext,
  getServiceStore,
  toServiceState,
  subscribeSSE,
  type ServiceInitialData
} from '@/lib/service-store'
import ServiceList from '@/app/(sidebar)/service-list'
import StatusNotifier from '@/app/(sidebar)/status-notifier'

function ServiceStoreProvider({
  initialData,
  children
}: {
  initialData: ServiceInitialData
  children: ReactNode
}) {
  // 复用模块级单例 store，跨导航保持状态与订阅连续性
  // useState 惰性初始化每次挂载都会执行 getServiceStore，但内部幂等返回同一实例
  const [store] = useState(() => getServiceStore(initialData))
  // initialData 派生快照（本次渲染上下文），供 SSR 与 hydration 首帧匹配使用
  const [server] = useState(() => toServiceState(initialData))

  useEffect(() => {
    subscribeSSE()
  }, [])

  return (
    <ServiceStoreContext.Provider value={store}>
      <ServerSnapshotContext.Provider value={server}>{children}</ServerSnapshotContext.Provider>
    </ServiceStoreContext.Provider>
  )
}

export default function SidebarLayout({
  children,
  ...initialData
}: ServiceInitialData & { children: ReactNode }) {
  return (
    <ServiceStoreProvider initialData={initialData}>
      <StatusNotifier />
      <div className="flex flex-1 h-full gap-4 p-4">
        <ServiceList />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </ServiceStoreProvider>
  )
}
