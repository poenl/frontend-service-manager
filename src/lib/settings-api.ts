import type { ProjectDir, ScheduleConfig } from '@/lib/config'
import { request } from '@/lib/http'

const BASE = '/api/settings/project-dirs'

export async function fetchProjectDirs(): Promise<ProjectDir[]> {
  return request(BASE)
}

export async function addProjectDir(input: { name: string; path: string }): Promise<ProjectDir[]> {
  return request(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
}

export async function removeProjectDir(path: string): Promise<ProjectDir[]> {
  return request(`${BASE}?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
}

export async function updateProjectDir(
  oldPath: string,
  data: { name?: string; path?: string }
): Promise<ProjectDir[]> {
  return request(BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, ...data })
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
