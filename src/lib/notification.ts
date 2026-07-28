/**
 * Browser Notification API 封装
 * 用于发送 OS 级桌面通知（与 sonner 内联 Toast 互补）
 */

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission(): NotificationPermission | 'unsupported' {
  if (!isSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * 请求通知权限。
 * 浏览器对重复请求会静默返回当前状态，不会重复弹窗。
 */
export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isSupported()) return 'unsupported'
  return await Notification.requestPermission()
}

/**
 * 发送系统通知。
 * 页面可见时不打扰（由 sonner toast 承担），仅在页面隐藏时发送。
 * @param onClick 额外点击回调，调用者定义焦点外的逻辑。默认行为是 window.focus()。调用后通知自动关闭。
 * @returns Notification 实例，权限/条件不足时返回 null
 */
export function showNotification(
  title: string,
  options?: NotificationOptions,
  onClick?: (notification: Notification) => void
): Notification | null {
  if (!isSupported() || Notification.permission !== 'granted') return null
  // 页面可见时不发送系统通知
  if (document.visibilityState !== 'hidden') return null
  const notification = new Notification(title, options)
  notification.onclick = () => {
    window.focus()
    onClick?.(notification)
    notification.close()
  }
  return notification
}
