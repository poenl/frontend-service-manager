import Conf from 'conf'

export interface ServiceConfig {
  id: string
  name: string
  projectDir: string
  backendHost: string
  backendPort: string
  frontendPort: string
}

export interface ProjectDir {
  name: string
  path: string
}

interface Store {
  services: ServiceConfig[]
  projectDirs: ProjectDir[]
}

let _store: Conf<Store> | null = null

function store(): Conf<Store> {
  if (!_store) {
    _store = new Conf<Store>({
      projectName: 'ui-server',
      defaults: { services: [], projectDirs: [] }
    })
  }
  return _store
}

export function getServices(): ServiceConfig[] {
  return store().get('services')
}

export function getService(id: string): ServiceConfig | undefined {
  return store()
    .get('services')
    .find((s) => s.id === id)
}

export function addService(input: Omit<ServiceConfig, 'id'>): ServiceConfig {
  const svc: ServiceConfig = {
    id: crypto.randomUUID(),
    ...input
  }
  store().set('services', [...store().get('services'), svc])
  return svc
}

export function updateService(
  id: string,
  patch: Partial<ServiceConfig>
): ServiceConfig | undefined {
  const services = store().get('services')
  const idx = services.findIndex((s) => s.id === id)
  if (idx === -1) return undefined
  const updated = { ...services[idx], ...patch, id }
  services[idx] = updated
  store().set('services', services)
  return updated
}

export function deleteService(id: string): boolean {
  const services = store().get('services')
  const filtered = services.filter((s) => s.id !== id)
  if (filtered.length === services.length) return false
  store().set('services', filtered)
  return true
}

export function getProjectDirs(): ProjectDir[] {
  const raw: unknown = store().get('projectDirs')
  // 兼容旧版本 string[] 格式 —— 自动迁移为 { name, path }
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
    const migrated: ProjectDir[] = (raw as string[]).map((p) => ({ name: '', path: p }))
    store().set('projectDirs', migrated)
    return migrated
  }
  return raw as ProjectDir[]
}

export function addProjectDir(input: { name: string; path: string }): ProjectDir[] {
  const dirs = getProjectDirs()
  if (dirs.some((d) => d.path === input.path)) return dirs
  const updated = [...dirs, input]
  store().set('projectDirs', updated)
  return updated
}

export function removeProjectDir(path: string): ProjectDir[] {
  const dirs = getProjectDirs().filter((d) => d.path !== path)
  store().set('projectDirs', dirs)
  return dirs
}

export function updateProjectDir(
  oldPath: string,
  data: { name?: string; path?: string }
): ProjectDir[] | null {
  const dirs = getProjectDirs()
  const idx = dirs.findIndex((d) => d.path === oldPath)
  if (idx === -1) return null
  const newPath = data.path ?? oldPath
  if (newPath !== oldPath && dirs.some((d) => d.path === newPath)) return null
  const updated = [...dirs]
  updated[idx] = { ...updated[idx], ...data, path: newPath }
  store().set('projectDirs', updated)
  return updated
}
