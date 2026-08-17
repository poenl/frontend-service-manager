import { Inbox } from 'lucide-react'
import { redirect } from 'next/navigation'
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent
} from '@/components/ui/empty'
import { getServices } from '@/lib/config'
import CreateServiceButton from '@/app/(sidebar)/create-service-button'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const services = getServices()

  if (services.length > 0) {
    redirect('/service/' + services[0].id)
  }

  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>暂无服务</EmptyTitle>
        <EmptyDescription>创建你的第一个服务，即可开始管理</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateServiceButton />
      </EmptyContent>
    </Empty>
  )
}
