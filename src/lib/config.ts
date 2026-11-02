import Conf from 'conf'
import { homedir } from 'node:os'
import { PROJECT_TYPES, type ProjectType, type ProjectTypeEnvField } from '@/lib/project-types'

export interface ServiceConfig {
  id: string
  name: string
  // 关联的项目配置 id（不可变主键），运行时按 id 解析目录路径
  projectId: string
  backendProtocol?: 'http' | 'https'
  backendHost: string
  backendPort: string
  frontendPort: string
}

// 项目类型来自注册表（决定启动命令与需要配置的变量名），新增类型无需改此文件
export type { ProjectType }

export type ProjectConfig = {
  // 不可变主键，服务通过 id 关联项目配置（不随 name/path 变更而失效）
  id: string
  name: string
  path: string
  // 项目类型，旧数据无该字段时读取时按 vite 归一化
  type: ProjectType
} & Partial<Record<ProjectTypeEnvField, string>>

// 项目配置写入入参：每个类型只要求注册表声明的变量名字段，从类型层阻止脏字段
export type ProjectConfigInput = {
  [K in ProjectType]: { type: K; name: string; path: string } & Record<
    keyof (typeof PROJECT_TYPES)[K]['envFields'],
    string
  >
}[ProjectType]

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
  projectConfigs: ProjectConfig[]
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
        projectConfigs: [],
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

// 项目路径归一化：展开 `~` 为家目录，供 API 校验与服务启动共用，避免两处解析规则漂移
export function resolveProjectPath(raw: string): string {
  return raw.replace(/^~(?=\/|$)/, homedir())
}

// 按类型只保留注册表声明的变量名字段，避免存储里的陈旧字段（如切回 vite 后的端口变量名）泄漏到表单与启动逻辑
function pickEnvFields(
  source: Partial<Record<ProjectTypeEnvField, string>>,
  type: ProjectType
): Partial<Record<ProjectTypeEnvField, string>> {
  const kept: Partial<Record<ProjectTypeEnvField, string>> = {}
  for (const field of Object.keys(PROJECT_TYPES[type].envFields) as ProjectTypeEnvField[]) {
    const value = source[field]
    if (value) kept[field] = value
  }
  return kept
}

export function getProjectConfigs(): ProjectConfig[] {
  // 旧数据无 type 字段，读取时补为 vite（不写盘迁移，避免改动存储结构）
  return store()
    .get('projectConfigs')
    .map((c) => {
      const type = c.type ?? 'vite'
      return { id: c.id, name: c.name, path: c.path, type, ...pickEnvFields(c, type) }
    })
}

export function addProjectConfig(input: ProjectConfigInput): ProjectConfig[] {
  const configs = getProjectConfigs()
  if (configs.some((c) => c.path === input.path)) return configs
  const config: ProjectConfig = { id: crypto.randomUUID(), ...input }
  const updated = [...configs, config]
  store().set('projectConfigs', updated)
  return updated
}

export function removeProjectConfig(id: string): ProjectConfig[] {
  const configs = getProjectConfigs().filter((c) => c.id !== id)
  store().set('projectConfigs', configs)
  return configs
}

export function updateProjectConfig(
  id: string,
  data: Partial<ProjectConfigInput> & { name?: string; path?: string; type?: ProjectType }
): ProjectConfig[] | null {
  const configs = getProjectConfigs()
  const idx = configs.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const newPath = data.path ?? configs[idx].path
  if (newPath !== configs[idx].path && configs.some((c) => c.path === newPath)) return null
  const updated = [...configs]
  const merged: ProjectConfig = { ...updated[idx], ...data, path: newPath }
  // 重新组装而非修改 merged：类型切换后只保留新类型声明的字段，陈旧变量名不再落盘
  updated[idx] = {
    id: merged.id,
    name: merged.name,
    path: merged.path,
    type: merged.type,
    ...pickEnvFields(merged, merged.type)
  }
  store().set('projectConfigs', updated)
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
