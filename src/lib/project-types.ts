// 项目类型注册表：一种项目类型的全部差异（展示名、启动命令、需要配置的变量名）集中在此，
// 新增类型只需在此加一个条目并为图标映射补一行，其余代码按注册表驱动，不再逐处分支

// 变量名字段：键即 ProjectConfig 上的字段名，value 指明启动时注入值的来源
export interface EnvFieldDefinition {
  label: string
  placeholder: string
  value: 'backendBaseUrl' | 'frontendPort'
}

// 构造启动命令时可用的上下文
export interface LaunchContext {
  frontendPort: string
  // 后端基地址；后端地址未配置时为空，此时不注入该变量
  backendBaseUrl?: string
}

interface ProjectTypeDefinition {
  label: string
  // 启动命令二进制，由包管理器执行（如 pnpm <bin>）
  bin: string
  // 该类型需要用户填写的变量名，键顺序即表单字段顺序
  envFields: Record<string, EnvFieldDefinition>
  // 类型特异的启动参数（不含 bin）
  args: (ctx: LaunchContext) => string[]
}

const PROJECT_TYPES = {
  vite: {
    label: 'Vite',
    bin: 'vite',
    envFields: {
      backendEnvVar: {
        label: '后端地址变量名',
        placeholder: 'VITE_API_BASE_URL',
        value: 'backendBaseUrl'
      }
    },
    args: (ctx) => ['--no-open', ...(ctx.frontendPort ? ['--port', ctx.frontendPort] : [])]
  },
  electron: {
    label: 'Electron',
    bin: 'electron-vite',
    envFields: {
      backendEnvVar: {
        label: '后端地址变量名',
        placeholder: 'VITE_API_BASE_URL',
        value: 'backendBaseUrl'
      },
      // Electron 的 dev server 端口经变量传给主进程，不能靠 CLI 参数
      frontendPortEnvVar: {
        label: '前端端口变量名',
        placeholder: 'VITE_DEV_SERVER_PORT',
        value: 'frontendPort'
      }
    },
    args: () => ['dev']
  }
} satisfies Record<string, ProjectTypeDefinition>

export { PROJECT_TYPES }

export type ProjectType = keyof typeof PROJECT_TYPES

// 全部类型条目的数组形式，供表单选项与 schema 生成遍历
export const PROJECT_TYPE_LIST = (
  Object.keys(PROJECT_TYPES) as ProjectType[]
).map((type) => [type, PROJECT_TYPES[type]] as const)

// 变量名字段名的并集（backendEnvVar | frontendPortEnvVar），随注册表自动扩展
export type ProjectTypeEnvField = {
  [K in ProjectType]: keyof (typeof PROJECT_TYPES)[K]['envFields']
}[ProjectType]
