'use client'

import { useState, useEffect, useRef } from 'react'
import { Settings, Pause, Play, Square, ArrowUpRight, Copy, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut
} from '@/components/ui/context-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { useFrontendUrl } from '@/lib/use-frontend-url'
import { useServiceStore, setOperating } from '@/lib/service-store'
import type { ServiceConfig } from '@/lib/config'
import {
  createService,
  fetchRandomPort,
  operateService,
  pauseAllServices,
  removeService,
  resumeAllServices
} from '@/lib/service-api'

// 平台检测：macOS 快捷键用 ⌘ 符号展示，其余平台用 Ctrl 文字
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

// 生成不重名的副本名称：`原名 (副本)`、`原名 (副本 2)`……
function duplicateName(services: ServiceConfig[], name: string): string {
  if (!name) return ''
  const taken = new Set(services.map((s) => s.name))
  if (!taken.has(`${name} (副本)`)) return `${name} (副本)`
  let n = 2
  while (taken.has(`${name} (副本 ${n})`)) n++
  return `${name} (副本 ${n})`
}

// 复制服务：名称加副本后缀，前端端口随机重分配（避免与源服务端口冲突），其余字段原样
// 菜单点击与全局快捷键共用，避免重复逻辑
async function duplicateService(
  services: ServiceConfig[],
  svc: ServiceConfig,
  onCreated: (id: string) => void
): Promise<void> {
  const { port } = await fetchRandomPort()
  const dup = await createService({
    name: duplicateName(services, svc.name),
    projectDir: svc.projectDir,
    backendHost: svc.backendHost,
    backendPort: svc.backendPort,
    frontendPort: String(port)
  })
  if (dup) onCreated(dup.id)
}

function ServiceItem({
  id,
  name,
  backendPort,
  frontendPort,
  readyToStart,
  selected,
  operating,
  onStart,
  onStop,
  onDuplicate,
  onRequestDelete
}: {
  id: string
  name: string
  backendPort: string
  frontendPort: string
  readyToStart: boolean
  selected: boolean
  operating: { id: string; action: 'start' | 'stop' } | null
  onStart: (id: string) => void
  onStop: (id: string) => void
  onDuplicate: (id: string) => void
  onRequestDelete: (id: string) => void
}) {
  const router = useRouter()
  const running = useServiceStore((s) => s.running)
  const hostname = useServiceStore((s) => s.hostname)
  const url = useFrontendUrl(frontendPort, !!running[id], hostname)

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <button
            type="button"
            onClick={() => router.push('/service/' + id)}
            data-selected={selected || undefined}
            className="relative flex items-center justify-between w-full rounded-lg px-3 py-2 overflow-hidden text-left text-sm transition-colors hover:bg-muted data-selected:bg-muted data-selected:font-bold group"
          >
            <span className="absolute inset-0 flex items-center justify-center text-3xl font-extrabold text-muted-foreground/20 pointer-events-none select-none">
              {backendPort ? `:${backendPort}` : ''}
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
              <span className="flex-1 truncate font-medium group-data-selected:font-bold">
                {name || '未命名服务'}
              </span>
            </div>
            <Badge
              variant={running[id] ? 'default' : 'secondary'}
              className="shrink-0 cursor-pointer"
              onClick={
                url
                  ? (e) => {
                      e.stopPropagation()
                      window.open(url, '_blank')
                    }
                  : undefined
              }
            >
              {operating?.id === id && <Spinner className="size-3" />}
              {running[id] ? '运行中' : '已停止'}
              {running[id] && frontendPort ? <ArrowUpRight className="size-3 ml-0.5" /> : null}
            </Badge>
          </button>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem
          disabled={running[id] || !readyToStart || operating?.id === id}
          onClick={() => onStart(id)}
        >
          <Play /> 启动
        </ContextMenuItem>
        <ContextMenuItem disabled={!running[id] || operating?.id === id} onClick={() => onStop(id)}>
          <Square /> 停止
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(id)}>
          <Copy /> 复制
          <ContextMenuShortcut>{isMac ? '⌘C' : 'Ctrl+C'}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onRequestDelete(id)}>
          <Trash2 /> 删除
          <ContextMenuShortcut>{isMac ? '⌘⌫' : 'Ctrl+Backspace'}</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export default function ServiceList() {
  const router = useRouter()
  const params = useParams<{ id?: string }>()
  const selectedId = params?.id ?? ''

  const services = useServiceStore((s) => s.services)
  const running = useServiceStore((s) => s.running)
  const pausedCount = useServiceStore((s) => s.pausedCount)
  const isLocal = useServiceStore((s) => s.isLocal)
  const operating = useServiceStore((s) => s.operating)

  const [globalBusy, setGlobalBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  // 打开删除弹窗时聚焦确认按钮，回车即确认删除
  const deleteConfirmRef = useRef<HTMLButtonElement>(null)

  const hasRunning = Object.values(running).some(Boolean)

  const handleAdd = async () => {
    try {
      const svc = await createService({
        name: '',
        projectDir: '',
        backendHost: '',
        backendPort: '',
        frontendPort: ''
      })
      if (svc) router.push('/service/' + svc.id)
    } catch {
      /* ignore */
    }
  }

  // 复制当前服务：名称加副本后缀，前端端口随机重分配（避免与源服务端口冲突），其余字段原样
  const handleDuplicate = async (id: string) => {
    const svc = services.find((s) => s.id === id)
    if (!svc) return
    try {
      await duplicateService(services, svc, (newId) => router.push('/service/' + newId))
    } catch {
      /* request() 已 toast 错误 */
    }
  }

  // 菜单启动/停止：操作期间写入共享状态（详情页同步 loading），失败由 request() 统一 toast
  const handleOperate = async (id: string, action: 'start' | 'stop') => {
    setOperating({ id, action })
    try {
      await operateService(id, action)
    } catch {
      /* request() 已 toast 错误 */
    } finally {
      setOperating(null)
    }
  }

  // 全局快捷键：Cmd/Ctrl+C 复制当前选中服务，Cmd/Ctrl+Backspace 删除（走确认弹窗）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 输入控件聚焦时让位原生行为，避免编辑中误触
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      const mod = e.metaKey || e.ctrlKey
      if (!mod || e.altKey) return

      if (e.key.toLowerCase() === 'c' && !e.shiftKey) {
        // 有选中文本时让位系统复制，否则复制当前选中服务
        if (window.getSelection()?.toString()) return
        e.preventDefault()
        if (!selectedId) return
        const svc = services.find((s) => s.id === selectedId)
        if (svc) {
          void duplicateService(services, svc, (newId) => router.push('/service/' + newId)).catch(
            () => {
              /* request() 已 toast 错误 */
            }
          )
        }
      } else if (e.key === 'Backspace' && !e.shiftKey) {
        e.preventDefault()
        if (selectedId) setDeleteId(selectedId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, services, router])

  const handlePauseAll = async () => {
    setGlobalBusy(true)
    try {
      await pauseAllServices()
    } catch {
      /* ignore */
    } finally {
      setGlobalBusy(false)
    }
  }

  // 确认删除：若删除的是当前选中服务则跳回首页，否则留在当前页
  const handleDelete = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await removeService(deleteId)
      if (deleteId === selectedId) router.push('/')
      setDeleteId(null)
    } catch {
      /* request() 已 toast 错误 */
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResumeAll = async () => {
    setGlobalBusy(true)
    try {
      await resumeAllServices()
    } catch {
      /* ignore */
    } finally {
      setGlobalBusy(false)
    }
  }

  return (
    <Card className="w-72 shrink-0 h-full">
      <CardHeader>
        <CardTitle>服务列表</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 flex-1">
        <ScrollArea>
          <div className="flex flex-col gap-1.5">
            {services.map((s) => (
              <ServiceItem
                key={s.id}
                id={s.id}
                name={s.name}
                backendPort={s.backendPort}
                frontendPort={s.frontendPort}
                readyToStart={
                  !!(s.name && s.projectDir && s.backendHost && s.backendPort && s.frontendPort)
                }
                selected={s.id === selectedId}
                operating={operating}
                onStart={(id) => handleOperate(id, 'start')}
                onStop={(id) => handleOperate(id, 'stop')}
                onDuplicate={handleDuplicate}
                onRequestDelete={setDeleteId}
              />
            ))}
          </div>
        </ScrollArea>
        <Button onClick={handleAdd} variant="outline" className="w-full mt-2">
          + 添加服务
        </Button>
        <div className="flex gap-2 mt-auto">
          <Button
            onClick={handlePauseAll}
            variant="outline"
            className="flex-1"
            disabled={!hasRunning || globalBusy}
          >
            <Pause className="size-3.5 mr-1" /> 暂停
          </Button>
          <Button
            onClick={handleResumeAll}
            variant="outline"
            className="flex-1"
            disabled={pausedCount === 0 || globalBusy}
          >
            <Play className="size-3.5 mr-1" /> 恢复
          </Button>
        </div>
      </CardContent>
      <CardFooter>
        {isLocal ? (
          <Link
            href="/settings"
            className="flex justify-center items-center gap-2 w-full rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Settings className="size-4" /> 全局设置
          </Link>
        ) : (
          <span className="flex justify-center items-center gap-2 w-full rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed">
            <Settings className="size-4" /> 全局设置
          </span>
        )}
      </CardFooter>
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent initialFocus={deleteConfirmRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确定要删除此服务吗？此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <Button
              ref={deleteConfirmRef}
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Spinner />}
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
