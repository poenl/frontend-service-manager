import type { ProjectConfig, ScheduleConfig } from '@/lib/config'
import { request } from '@/lib/http'

const BASE = '/api/settings/project-configs'

export async function fetchProjectConfigs(): Promise<ProjectConfig[]> {
  return request(BASE)
}

export async function addProjectConfig(input: {
  name: string
  path: string
  backendEnvVar: string
}): Promise<ProjectConfig[]> {
  return request(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

export async function removeProjectConfig(id: string): Promise<ProjectConfig[]> {
  return request(`${BASE}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function updateProjectConfig(
  id: string,
  data: { name?: string; path?: string; backendEnvVar?: string }
): Promise<ProjectConfig[]> {
  return request(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data })
  })
}

const SCHEDULE_BASE = '/api/settings/schedule'

export async function fetchSchedule(): Promise<ScheduleConfig> {
  return request(SCHEDULE_BASE)
}

export async function updateSchedule(data: ScheduleConfig): Promise<ScheduleConfig> {
  return request(SCHEDULE_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}
