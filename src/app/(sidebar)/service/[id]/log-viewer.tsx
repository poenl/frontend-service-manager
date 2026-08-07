'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import anser from 'anser'

// 固定行高：text-xs(12px) + leading-5(20px)，虚拟列表的偏移计算依赖该值
const ROW_HEIGHT = 20
// 可视区上下各多渲染的行数，避免快速滚动时出现空白
const OVERSCAN = 10
// 距底部小于该像素即视为贴底，贴底时才自动跟随新日志
const BOTTOM_THRESHOLD = 40

// 单行日志：ansi 解析结果与行内容一一对应，惰性初始化使每个虚拟节点只解析一次
function LogLine({ line }: { line: string }) {
  const [html] = useState(() => anser.ansiToHtml(line, { use_classes: false }))
  return (
    <div
      className="h-5 overflow-hidden whitespace-pre px-3 text-xs leading-5 font-mono"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default function LogViewer({ lines }: { lines: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 是否贴底（钉住最新日志）；用户向上翻看历史时置为 false，不再被新日志打扰
  const stickToBottomRef = useRef(true)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(0)

  // 容器尺寸变化时更新可视高度；贴底状态下高度变化保持钉在底部
  // （flex 布局首帧高度为 0，也由此处修正为真实可视高度）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setViewportH(el.clientHeight)
    const ro = new ResizeObserver(() => {
      setViewportH(el.clientHeight)
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 新日志到达时，仅当用户处于贴底状态才跟随到最新
  useEffect(() => {
    const el = containerRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [lines])

  const totalHeight = lines.length * ROW_HEIGHT
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const end = Math.min(lines.length, Math.ceil((scrollTop + viewportH) / ROW_HEIGHT) + OVERSCAN)

  const visibleRows = []
  for (let i = start; i < end; i++) {
    visibleRows.push(
      <div key={i} className="absolute left-0 right-0" style={{ top: i * ROW_HEIGHT }}>
        <LogLine line={lines[i]} />
      </div>
    )
  }

  return (
    <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-lg border bg-muted/30">
      <div
        ref={containerRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottomRef.current =
            el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_THRESHOLD
          // flushSync 强制同步提交可见行，保证重渲染与浏览器滚动绘制同帧，
          // 避免快速滚动时视口落入尚未渲染的空白区
          flushSync(() => setScrollTop(el.scrollTop))
        }}
        className="h-full w-full overflow-auto"
      >
        {lines.length === 0 ? (
          <div className="p-3 text-xs text-muted-foreground">暂无日志</div>
        ) : (
          <div className="relative" style={{ height: totalHeight }}>
            {visibleRows}
          </div>
        )}
      </div>
    </div>
  )
}
