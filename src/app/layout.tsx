import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import { getSchedule } from '@/lib/config'
import { isSkipPauseActive } from '@/lib/schedule'
import { isWorkday } from '@/lib/workday'
import { ScheduleReminder } from './schedule-reminder'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Frontend Service Manager',
  description: 'Vite 开发服务管理面板',
  icons: { icon: '/icon.svg' }
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const schedule = getSchedule()
  const workday = await isWorkday(new Date())
  // 刷新时从服务端恢复当天跳过状态，避免客户端内存态丢失后重复提醒
  const skippedToday = isSkipPauseActive()

  return (
    <html lang="zh" className={`${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex flex-col overflow-hidden">
        <Toaster />
        <ScheduleReminder
          isWorkday={workday}
          initialSkippedToday={skippedToday}
          schedule={{
            enabled: schedule.enabled,
            pauseTime: schedule.pauseTime,
            reminderEnabled: schedule.reminderEnabled,
            reminderMinutes: schedule.reminderMinutes
          }}
        />
        {children}
      </body>
    </html>
  )
}
