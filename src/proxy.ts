import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { hostname } = request.nextUrl;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/settings/:path*",
};
