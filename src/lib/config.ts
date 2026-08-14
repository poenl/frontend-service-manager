import Conf from 'conf'

export interface ServiceConfig {
  id: string
  name: string
  projectDir: string
  backendProtocol?: 'http' | 'https'
  backendHost: string
  backendPort: string
  frontendPort: string
}

export interface ProjectDir {
  name: string
  path: string
}

export interface ScheduleConfig {
  enabled: boolean
  pauseTime: string
  resumeTime: string
  autoResume: boolean
  reminderEnabled: boolean
  reminderMinutes: number
}

// 全年节假日数据缓存（一次拉取即全年数据，持久化到本地供重启后复用）
export interface WorkdayCache {
  year: number
  holidays: string[]
  workdays: string[]
}

interface Store {
  services: ServiceConfig[]
  projectDirs: ProjectDir[]
  schedule: ScheduleConfig
  skipPauseDate?: string
  workdayCache?: WorkdayCache
}

let _store: Conf<Store> | null = null

function store(): Conf<Store> {
  if (!_store) {
    _store = new Conf<Store>({
      projectName: 'frontend-service-manager',
      defaults: {
        services: [],
        projectDirs: [],
        schedule: {
          enabled: false,
          pauseTime: '18:00',
          resumeTime: '09:00',
          autoResume: true,
          reminderEnabled: false,
          reminderMinutes: 30
        }
      }
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

// 按传入 id 顺序重排服务列表（数组顺序即展示排序），并持久化。
// 校验 ids 与当前服务一一对应（长度一致、无重复、id 均存在），不满足则返回 null 拒绝写入。
export function reorderServices(ids: string[]): ServiceConfig[] | null {
  const services = store().get('services')
  if (ids.length !== services.length || new Set(ids).size !== ids.length) return null
  const byId = new Map(services.map((s) => [s.id, s]))
  const reordered = ids.map((id) => byId.get(id))
  if (reordered.some((s) => s === undefined)) return null
  store().set('services', reordered as ServiceConfig[])
  return reordered as ServiceConfig[]
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

const SCHEDULE_DEFAULTS: Pick<ScheduleConfig, 'reminderEnabled' | 'reminderMinutes'> = {
  reminderEnabled: false,
  reminderMinutes: 30
}

export function getSchedule(): ScheduleConfig {
  return { ...SCHEDULE_DEFAULTS, ...store().get('schedule') }
}

export function setSchedule(config: ScheduleConfig): ScheduleConfig {
  store().set('schedule', config)
  return config
}

export function getSkipPauseDate(): string | undefined {
  return store().get('skipPauseDate')
}

export function setSkipPauseDate(date: string | undefined) {
  // conf 的 set() 传 undefined 会抛错，清除值需用 delete()
  if (date === undefined) {
    store().delete('skipPauseDate')
  } else {
    store().set('skipPauseDate', date)
  }
}

export function getWorkdayCache(): WorkdayCache | undefined {
  return store().get('workdayCache')
}

export function setWorkdayCache(cache: WorkdayCache) {
  store().set('workdayCache', cache)
}
