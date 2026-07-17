'use client'

import { useSyncExternalStore } from 'react'

export function useFrontendUrl(port: string | undefined, running: boolean): string | null {
  const hostname = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname,
    () => ''
  )
  if (!hostname || !port || !running) return null
  return `http://${hostname}:${port}`
}
