import { NextRequest, NextResponse } from 'next/server'
import { getSchedule, setSchedule } from '@/lib/config'
import { reloadSchedule, unskipPause } from '@/lib/schedule'
import type { ScheduleConfig } from '@/lib/config'

export async function GET() {
  return NextResponse.json(getSchedule())
}

export async function PUT(request: NextRequest) {
  const data: ScheduleConfig = await request.json()
  const result = setSchedule(data)
  reloadSchedule()
  // 配置更改即重新评估今天的自动暂停，清除跳过标记并广播最新提醒状态
  await unskipPause()
  return NextResponse.json(result)
}
