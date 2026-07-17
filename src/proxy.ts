import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/settings')) {
    const host = request.headers.get('host') || ''
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/settings', '/settings/:path*']
}
