import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/signup", "/admin/login"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const adminToken = request.cookies.get("admin_token")?.value
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    return NextResponse.next()
  }

  const token = request.cookies.get("access_token")?.value
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (!isPublic && !token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
