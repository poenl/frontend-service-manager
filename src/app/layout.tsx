import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/toast'
import { ScheduleReminder } from './schedule-reminder'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: '前端服务管理器',
  description: 'Vite 开发服务管理面板',
  icons: { icon: '/icon.svg' }
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh" className={`${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full flex flex-col overflow-hidden">
        {/* 仅跟随系统深色模式：在 hydration 前同步 prefers-color-scheme 到 <html>.dark，并实时响应系统切换，避免首帧闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var m=matchMedia('(prefers-color-scheme: dark)');var apply=function(){document.documentElement.classList.toggle('dark',m.matches)};apply();m.addEventListener('change',apply)})()`
          }}
        />
        <Toaster />
        <ScheduleReminder />
        {children}
      </body>
    </html>
  )
}
