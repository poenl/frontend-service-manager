import { headers } from 'next/headers'
import { getServices, getProjectDirs } from '@/lib/config'
import { getServiceStatus, getServiceLogs, getPausedCount } from '@/lib/service-process'
import HomeClient from './client'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const services = getServices()
  const projectDirs = getProjectDirs()

  const initialRunning: Record<string, boolean> = {}
  const initialLogs: Record<string, string[]> = {}

  for (const s of services) {
    initialRunning[s.id] = getServiceStatus(s.id).running
    initialLogs[s.id] = getServiceLogs(s.id).logs
  }

  const initialPausedCount = getPausedCount()
  const host = (await headers()).get('host') || ''
  const initialIsLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const initialHostname = host.split(':')[0]

  return (
    <HomeClient
      initialServices={services}
      initialProjectDirs={projectDirs}
      initialRunning={initialRunning}
      initialLogs={initialLogs}
      initialPausedCount={initialPausedCount}
      initialIsLocal={initialIsLocal}
      initialHostname={initialHostname}
    />
  )
}
