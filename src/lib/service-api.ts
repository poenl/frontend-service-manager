import type { ServiceConfig } from "@/lib/config";

const BASE = "/api/service";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchServices(): Promise<ServiceConfig[]> {
  return request(BASE);
}

export async function createService(
  data: Omit<ServiceConfig, "id">
): Promise<ServiceConfig> {
  return request(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateService(
  id: string,
  patch: Partial<ServiceConfig>
): Promise<ServiceConfig> {
  return request(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function removeService(id: string): Promise<void> {
  await fetch(`${BASE}/${id}`, { method: "DELETE" });
}

export async function operateService(
  id: string,
  action: "start" | "stop"
): Promise<{ success: boolean; message: string }> {
  return request(`${BASE}/${id}/${action}`, { method: "POST" });
}

export async function fetchServiceStatus(
  id: string
): Promise<{ running: boolean; pid?: number; uptime?: number }> {
  return request(`${BASE}/${id}/status`);
}

export async function fetchServiceLogs(
  id: string,
  since = 0
): Promise<{ logs: string[] }> {
  return request(`${BASE}/${id}/logs?since=${since}`);
}
