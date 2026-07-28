import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh" className={`${geistMono.variable} h-full antialiased`}>
      <body className="h-full flex flex-col overflow-hidden">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
