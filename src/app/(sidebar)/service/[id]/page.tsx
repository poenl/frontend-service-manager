import { notFound } from 'next/navigation'
import { getServices } from '@/lib/config'
import ServiceDetailPanel from './detail-panel'

export const dynamic = 'force-dynamic'

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const services = getServices()

  if (!services.find((s) => s.id === id)) notFound()

  return <ServiceDetailPanel />
}
