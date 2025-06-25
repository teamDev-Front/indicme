import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  // Create an unmodified response
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.redirect() or similar, make
  // sure to:
  // 1. Pass along the request to the new response
  // 2. Copy the cookies from the supabaseResponse to the new response

  const pathname = request.nextUrl.pathname

  // Redirecionar para login se não estiver autenticado e tentar acessar área protegida
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    console.log('🚫 Usuário não autenticado, redirecionando para login')
    
    const redirectResponse = NextResponse.redirect(url)
    
    // CRITICAL: Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options)
    })
    
    return redirectResponse
  }

  // Redirecionar para dashboard se estiver autenticado e tentar acessar página de auth
  if (user && pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    console.log('✅ Usuário autenticado, redirecionando para dashboard')
    
    const redirectResponse = NextResponse.redirect(url)
    
    // CRITICAL: Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options)
    })
    
    return redirectResponse
  }

  // Redirecionar root para dashboard se autenticado, senão para login
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    
    if (user) {
      url.pathname = '/dashboard'
      console.log('✅ Root: Usuário autenticado, redirecionando para dashboard')
    } else {
      url.pathname = '/auth/login'
      console.log('🚫 Root: Usuário não autenticado, redirecionando para login')
    }
    
    const redirectResponse = NextResponse.redirect(url)
    
    // CRITICAL: Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options)
    })
    
    return redirectResponse
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  return supabaseResponse
}