import { headers } from 'next/headers'
import { getServices, getProjectConfigs } from '@/lib/config'
import { getServiceStatus, getServiceLogs, getPausedCount } from '@/lib/service-process'
import SidebarLayout from './sidebar-layout'

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const services = getServices()
  const projectConfigs = getProjectConfigs()
  const running: Record<string, boolean> = {}
  const logs: Record<string, string[]> = {}

  for (const s of services) {
    running[s.id] = getServiceStatus(s.id).running
    logs[s.id] = getServiceLogs(s.id).logs
  }

  const pausedCount = getPausedCount()
  const host = (await headers()).get('host') || ''
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const hostname = host.split(':')[0]

  return (
    <SidebarLayout
      services={services}
      projectConfigs={projectConfigs}
      running={running}
      logs={logs}
      pausedCount={pausedCount}
      isLocal={isLocal}
      hostname={hostname}
    >
      {children}
    </SidebarLayout>
  )
}
