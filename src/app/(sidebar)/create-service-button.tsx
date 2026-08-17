'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createService } from '@/lib/service-api'

export default function CreateServiceButton() {
  const router = useRouter()

  // 创建空服务并跳转编辑页，与列表页「+ 添加服务」逻辑一致；失败由 request() 统一 toast
  const handleAdd = async () => {
    try {
      const svc = await createService({
        name: '',
        projectId: '',
        backendHost: '',
        backendPort: '',
        frontendPort: ''
      })
      if (svc) router.push('/service/' + svc.id)
    } catch {
      /* ignore */
    }
  }

  return (
    <Button onClick={handleAdd}>
      <Plus /> 添加服务
    </Button>
  )
}
