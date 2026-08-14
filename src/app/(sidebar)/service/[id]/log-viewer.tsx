'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import anser from 'anser'

// 单行日志：ansi 解析结果与行内容一一对应，惰性初始化使每个虚拟节点只解析一次
function LogLine({ line }: { line: string }) {
  const [html] = useState(() => anser.ansiToHtml(line, { use_classes: false }))
  return (
    <div
      className="whitespace-pre-wrap wrap-break-word px-3 text-xs leading-5 font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function LogViewer({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  // 动态行高虚拟列表：长行可自动换行，measureElement 实测高度，
  // anchorTo 'end' + followOnAppend 保证贴底时自动跟随新日志
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 20,
    overscan: 10,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 40,
    useFlushSync: false // 关闭滚动同步 flushSync，避免 React 19 的 lifecycle 警告
  })

  const virtualItems = virtualizer.getVirtualItems()

  // 首屏定位到最新日志底部；追加跟随由 anchorTo 'end' + followOnAppend 接管
  useLayoutEffect(() => {
    virtualizer.scrollToEnd()
  }, [virtualizer])

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-lg border bg-muted/30">
      <div ref={containerRef} className="h-full w-full overflow-auto">
        {lines.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">暂无日志</div>
        ) : (
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualItems.map((item) => (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 right-0"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <LogLine line={lines[item.index]} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
