type EventHandler = (payload: unknown) => void

class EventBus {
  private listeners = new Map<string, Set<EventHandler>>()

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach((h) => h(payload))
  }
}

export const eventBus = new EventBus()
