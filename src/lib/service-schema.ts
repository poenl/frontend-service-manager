import { z } from 'zod'
import type { ServiceConfig } from '@/lib/config'

// 端口字段（后端端口可选）：可空字符串，若填写须为 0-65535 的纯数字
const optionalPort = z
  .string()
  .optional()
  .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 65535), '端口须为 0-65535 的数字')

// 前后端共享的启动配置校验规则：驱动后端 400 校验、详情页表单错误与列表启动项禁用
export const serviceConfigSchema = z.object({
  name: z.string().min(1, '请输入服务名称'),
  projectDir: z.string().min(1, '请输入项目目录'),
  backendProtocol: z.enum(['http', 'https']).optional(),
  backendHost: z.string().min(1, '请输入后端地址'),
  backendPort: optionalPort,
  frontendPort: z
    .string()
    .min(1, '请输入前端端口')
    .refine((v) => /^\d+$/.test(v), '端口须为数字')
})

// 派生字段级错误映射（首个错误为准），供前端逐字段绑定
export function getFieldErrors(config: ServiceConfig): Record<string, string> {
  const parsed = serviceConfigSchema.safeParse(config)
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
