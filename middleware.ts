import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response = NextResponse.next({ request })
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: settings } = await supabase
    .from('app_settings')
    .select('platform_enabled')
    .eq('id', 1)
    .single()

  const path = request.nextUrl.pathname
  const bypass = path.startsWith('/_next') || path.startsWith('/favicon')
  if (!bypass && settings && !settings.platform_enabled && path !== '/') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedRoutes = ['/dashboard', '/upload']
  const isProtected = protectedRoutes.some((route) => path.startsWith(route))

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
