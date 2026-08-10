'use client'

// 已打开的服务标签页再次点击时只聚焦不刷新：open('', name) 仅按名探测不导航，
// 跨域读取 location 会抛错 → 说明窗口已导航到目标服务（已存在）→ 仅 focus
export function openServiceTab(id: string, url: string) {
  const win = window.open('', `fsm-service-${id}`)
  if (!win) return
  let exists = true
  try {
    exists = win.location.href !== 'about:blank'
  } catch {
    /* 跨域读取被拒 → 已存在 */
  }
  if (exists) win.focus()
  else win.location.href = url
}
