'use client'

import { useEffect, useRef } from 'react'
import { sseClient } from './sse-client'

export function useSSE<T = unknown>(event: string, callback: (data: T) => void) {
  const cbRef = useRef(callback)

  useEffect(() => {
    cbRef.current = callback
  })

  useEffect(() => {
    const handler = (data: unknown) => cbRef.current(data as T)
    sseClient.on(event, handler)
    return () => sseClient.off(event, handler)
  }, [event])
}
