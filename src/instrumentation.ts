// Next.js 启动钩子：进程启动即重建定时暂停任务，
// 保证不打开页面时自动暂停/提醒/恢复也生效
//（否则 schedule.ts 仅在首次 API 请求时被懒加载，任务一直不设置）
export async function register() {
  // 排除 Edge 环境；Node/Deno/Bun 等 Node 兼容运行时均执行。
  // 动态 import 避免 Edge 侧打包 schedule 的 Node API 依赖链
  if (process.env.NEXT_RUNTIME !== 'edge') {
    const { reloadSchedule } = await import('@/lib/schedule')
    reloadSchedule()
  }
}
