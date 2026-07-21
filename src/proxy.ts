import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/settings') || pathname.startsWith('/api/settings')) {
    const host = request.headers.get('host') || ''
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/settings', '/settings/:path*', '/api/settings/:path*']
}
