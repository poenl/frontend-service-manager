import { redirect } from 'next/navigation'
import { getServices } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const services = getServices()

  if (services.length > 0) {
    redirect('/service/' + services[0].id)
  }

  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      {'暂无服务，点击左侧"+ 添加服务"创建'}
    </div>
  )
}
