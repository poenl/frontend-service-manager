import { toast } from '@/components/ui/toast'

/**
 * 统一请求工具：封装 fetch，
 * 非 2xx 时解析后端错误消息并 toast 提示，同时抛出错误供调用方感知。
 */
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, options)
  } catch {
    // 网络层失败（断网等），无响应可解析
    toast.add({ type: 'error', title: '网络请求失败' })
    throw new Error('网络请求失败')
  }

  if (!res.ok) {
    // 优先展示后端返回的具体错误信息（message/error 字段），缺失时回退状态码
    const body = await res.json().catch(() => null)
    const message = body?.message ?? body?.error ?? `请求失败（${res.status}）`
    toast.add({ type: 'error', title: message })
    throw new Error(message)
  }

  return res.json()
}
