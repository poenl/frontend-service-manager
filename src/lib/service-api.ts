import type { ServiceConfig } from '@/lib/config'
import { request } from '@/lib/http'

const BASE = '/api/service'

export async function fetchServices(): Promise<ServiceConfig[]> {
  return request(BASE)
}

export async function createService(data: Omit<ServiceConfig, 'id'>): Promise<ServiceConfig> {
  return request(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
}

export async function updateService(
  id: string,
  patch: Partial<ServiceConfig>
): Promise<ServiceConfig> {
  return request(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  })
}

export async function removeService(id: string): Promise<void> {
  await request(`${BASE}/${id}`, { method: 'DELETE' })
}

export async function operateService(
  id: string,
  action: 'start' | 'stop'
): Promise<{ success: boolean; message: string }> {
  return request(`${BASE}/${id}/${action}`, { method: 'POST' })
}

export async function fetchServiceStatus(
  id: string
): Promise<{ running: boolean; pid?: number; uptime?: number }> {
  return request(`${BASE}/${id}/status`)
}

export async function fetchServiceLogs(id: string, since = 0): Promise<{ logs: string[] }> {
  return request(`${BASE}/${id}/logs?since=${since}`)
}

export async function pauseAllServices(): Promise<{
  success: boolean
  message: string
  pausedCount: number
}> {
  return request(`${BASE}/pause`, { method: 'POST' })
}

export async function resumeAllServices(): Promise<{
  success: boolean
  message: string
  resumedCount: number
}> {
  return request(`${BASE}/resume`, { method: 'POST' })
}
