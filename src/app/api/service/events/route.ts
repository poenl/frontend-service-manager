import { getServices } from '@/lib/config'
import { getServiceStatus, getServiceLogs, getPausedCount } from '@/lib/service-process'
import { eventBus } from '@/lib/service-events'
import { computeReminderState } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // 发送初始快照：完整服务端状态（services/running/logs/pausedCount）
      // 每次连接（含 EventSource 重连）都整体推送，客户端在 snapshot 时整体替换，
      // 确保断连期间的日志、暂停计数、配置变更在重连后完整恢复
      const services = getServices()
      const running: Record<string, boolean> = {}
      const logs: Record<string, string[]> = {}
      for (const s of services) {
        running[s.id] = getServiceStatus(s.id).running
        logs[s.id] = getServiceLogs(s.id).logs
      }
      const snapshot = { services, running, logs, pausedCount: getPausedCount() }
      controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`))

      // 连接建立即推送一次当前提醒状态，避免「页面打开时正在提醒窗口内」漏掉通知
      controller.enqueue(
        encoder.encode(`event: reminder\ndata: ${JSON.stringify(await computeReminderState())}\n\n`)
      )

      // 监听实时事件
      const onStatus = (payload: unknown) => {
        const { id, running } = payload as { id: string; running: boolean }
        controller.enqueue(
          encoder.encode(`event: status\ndata: ${JSON.stringify({ id, running })}\n\n`)
        )
      }

      const onLog = (payload: unknown) => {
        const { id, line } = payload as { id: string; line: string }
        controller.enqueue(encoder.encode(`event: log\ndata: ${JSON.stringify({ id, line })}\n\n`))
      }

      const onPaused = (payload: unknown) => {
        const { pausedCount } = payload as { pausedCount: number }
        controller.enqueue(
          encoder.encode(`event: paused\ndata: ${JSON.stringify({ pausedCount })}\n\n`)
        )
      }

      const onServices = (payload: unknown) => {
        controller.enqueue(encoder.encode(`event: services\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      const onReminder = (payload: unknown) => {
        controller.enqueue(encoder.encode(`event: reminder\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      eventBus.on('status', onStatus)
      eventBus.on('log', onLog)
      eventBus.on('paused', onPaused)
      eventBus.on('services', onServices)
      eventBus.on('reminder', onReminder)

      req.signal.addEventListener('abort', () => {
        eventBus.off('status', onStatus)
        eventBus.off('log', onLog)
        eventBus.off('paused', onPaused)
        eventBus.off('services', onServices)
        eventBus.off('reminder', onReminder)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}
