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

  return (
    <HomeClient
      initialServices={services}
      initialProjectDirs={projectDirs}
      initialRunning={initialRunning}
      initialLogs={initialLogs}
      initialPausedCount={initialPausedCount}
    />
  )
}
