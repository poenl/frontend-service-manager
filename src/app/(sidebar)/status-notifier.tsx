'use client'

import { useRouter } from 'next/navigation'
import { useServiceStore } from '@/lib/service-store'
import { useSSE } from '@/lib/use-sse'
import { showNotification } from '@/lib/notification'

export default function StatusNotifier() {
  const router = useRouter()
  const services = useServiceStore((s) => s.services)

  useSSE('status', ({ id, running }: { id: string; running: boolean }) => {
    const svc = services.find((s) => s.id === id)
    if (svc?.name) {
      showNotification(running ? '服务已启动' : '服务已停止', { body: svc.name }, () =>
        router.push('/service/' + id)
      )
    }
  })

  return null
}
