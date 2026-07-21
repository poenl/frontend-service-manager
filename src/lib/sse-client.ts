import { requestPermission } from './notification'

type EventCallback = (data: unknown) => void

/**
 * SSE 客户端单例
 * - 首次 on() 调用时自动建立连接
 * - 连接持续到页面卸载，浏览器自动关闭 EventSource
 * - 消费方只需注册/注销事件，无需管理连接生命周期
 */
class SSEClient {
  private es: EventSource | null = null
  private listeners = new Map<string, Set<EventCallback>>()
  private nativeHandlers = new Map<string, (e: MessageEvent) => void>()

  private connect() {
    if (this.es) return
    this.es = new EventSource('/api/service/events')
    for (const event of this.listeners.keys()) this.attachNative(event)
    requestPermission()
  }

  on(event: string, cb: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
      if (this.es) this.attachNative(event)
    }
    this.listeners.get(event)!.add(cb)
    if (!this.es) this.connect()
  }

  off(event: string, cb: EventCallback) {
    this.listeners.get(event)?.delete(cb)
    if (this.listeners.get(event)?.size === 0) {
      this.detachNative(event)
      this.listeners.delete(event)
    }
  }

  private attachNative(event: string) {
    if (this.nativeHandlers.has(event)) return
    const handler = (e: MessageEvent) => {
      const data = JSON.parse(e.data)
      this.listeners.get(event)?.forEach((cb) => cb(data))
    }
    this.nativeHandlers.set(event, handler)
    this.es?.addEventListener(event, handler)
  }

  private detachNative(event: string) {
    const handler = this.nativeHandlers.get(event)
    if (handler) this.es?.removeEventListener(event, handler)
    this.nativeHandlers.delete(event)
  }
}

export const sseClient = new SSEClient()
