'use client'

import { useSyncExternalStore } from 'react'

export function useFrontendUrl(
  port: string | undefined,
  running: boolean,
  ssrHostname?: string
): string | null {
  const hostname = useSyncExternalStore(
    () => () => {},
    () => window.location.hostname,
    () => ssrHostname ?? ''
  )
  if (!hostname || !port || !running) return null
  return `http://${hostname}:${port}`
}
