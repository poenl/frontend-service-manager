'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { ServiceStoreContext, createServiceStore, subscribeSSE } from '@/lib/service-store'
import ServiceList from '@/app/(sidebar)/service-list'
import StatusNotifier from '@/app/(sidebar)/status-notifier'
import type { ServiceInitialData } from '@/lib/service-store'

function ServiceStoreProvider({
  initialData,
  children
}: {
  initialData: ServiceInitialData
  children: ReactNode
}) {
  const [store] = useState(() => createServiceStore(initialData))

  useEffect(() => {
    subscribeSSE(store)
  }, [store])

  return <ServiceStoreContext.Provider value={store}>{children}</ServiceStoreContext.Provider>
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
