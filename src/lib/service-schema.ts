import { z } from 'zod'
import type { ServiceConfig } from '@/lib/config'
import { PROJECT_TYPES, type EnvFieldDefinition } from '@/lib/project-types'

// 端口字段（后端端口可选）：可空字符串，若填写须为 0-65535 的纯数字
const optionalPort = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 65535), '端口须为 0-65535 的数字')

// 前后端共享的启动配置校验规则：驱动后端 400 校验、详情页表单错误与列表启动项禁用
export const serviceConfigSchema = z.object({
  name: z.string().min(1, '请输入服务名称'),
  projectId: z.string().min(1, '请选择项目配置'),
  backendProtocol: z.enum(['http', 'https']).optional(),
  backendHost: z.string().min(1, '请输入后端地址'),
  backendPort: optionalPort,
  frontendPort: z
    .string()
    .min(1, '请输入前端端口')
    .refine((v) => /^\d+$/.test(v), '端口须为数字')
})

// 变量名校验：须符合 shell 变量命名（字母或下划线开头，仅字母数字下划线）
const envVarName = (label: string) =>
  z
    .string()
    .min(1, `请输入${label}`)
    .refine((v) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(v), `${label}须为字母数字下划线，且以字母或下划线开头`)

// 项目配置公共字段
const projectBaseFields = {
  name: z.string().min(1, '请输入名称'),
  path: z.string().min(1, '请输入路径')
}

// 把某类型的 envFields 转为 zod 字段映射：键类型保留，label 与变量名规则均来自注册表
function envFieldSchemas<K extends string>(fields: Record<K, EnvFieldDefinition>) {
  return Object.fromEntries(
    (Object.entries(fields) as [string, EnvFieldDefinition][]).map(([field, def]) => [
      field,
      envVarName(def.label)
    ])
  ) as Record<K, z.ZodString>
}

// 项目配置校验：变量名字段随类型注册表自动变化（vite 只需后端地址变量名，electron 另需前端端口变量名）
// 与服务配置校验分离——项目配置承载注入变量名，两者是独立配置块
// 新增类型时在此加一个分支，字段集合仍由注册表提供
// ponytail: 分支手写而非从注册表动态生成 union，因为动态生成会丢失 parsed.data 的字段类型
// shortcut: 新增类型需手动加分支，字段仍自动跟随注册表，类型数量稳定后不必升级
export const projectConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('vite'),
    ...projectBaseFields,
    ...envFieldSchemas(PROJECT_TYPES.vite.envFields)
  }),
  z.object({
    type: z.literal('electron'),
    ...projectBaseFields,
    ...envFieldSchemas(PROJECT_TYPES.electron.envFields)
  })
])

// 派生字段级错误映射（首个错误为准），供前端逐字段绑定
export function getFieldErrors(config: ServiceConfig): Record<string, string> {
  return getSchemaFieldErrors(serviceConfigSchema, config)
}

// 泛化的 zod 字段级错误提取：safeParse 失败时映射 path → 首个错误消息
export function getSchemaFieldErrors(schema: z.ZodType, data: unknown): Record<string, string> {
  const parsed = schema.safeParse(data)
  if (parsed.success) return {}
  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '')
    if (key && !errors[key]) errors[key] = issue.message
  }
  return errors
}

// 前端端口冲突：与本服务管理器端口相同，或与其他服务 frontendPort 相同（详情页输入提示与启动判断共用）
export function getFrontendPortConflict(
  service: ServiceConfig,
  services: ServiceConfig[]
): string | null {
  const port = service.frontendPort
  if (!port) return null
  const selfPort = typeof window !== 'undefined' ? window.location.port : ''
  if (selfPort && port === selfPort) return `端口 ${port} 与本服务端口冲突`
  const conflict = services.find((o) => o.id !== service.id && o.frontendPort === port)
  if (conflict) return `端口 ${port} 已被「${conflict.name || '未命名'}」使用`
  return null
}

// 服务可启动：schema 静态校验通过且前端端口无冲突（列表与详情页共用，避免规则漂移）
export function isServiceStartable(service: ServiceConfig, services: ServiceConfig[]): boolean {
  return (
    serviceConfigSchema.safeParse(service).success && !getFrontendPortConflict(service, services)
  )
}
