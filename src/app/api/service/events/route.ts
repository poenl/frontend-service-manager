import { getServices } from '@/lib/config'
import { getServiceStatus } from '@/lib/service-process'
import { eventBus } from '@/lib/service-events'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // 发送初始快照：所有服务的当前状态
      const services = getServices()
      const snapshot = services.map((s) => ({
        id: s.id,
        ...getServiceStatus(s.id)
      }))
      controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`))

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

      eventBus.on('status', onStatus)
      eventBus.on('log', onLog)
      eventBus.on('paused', onPaused)

      // 30s 心跳保活
      const keepalive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 30000)

      req.signal.addEventListener('abort', () => {
        eventBus.off('status', onStatus)
        eventBus.off('log', onLog)
        eventBus.off('paused', onPaused)
        clearInterval(keepalive)
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
