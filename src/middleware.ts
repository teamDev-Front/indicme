import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  console.log('🔧 Middleware executando para:', request.nextUrl.pathname)
  
  try {
    // Atualizar a sessão usando a função do Supabase
    const response = await updateSession(request)
    
    console.log('✅ Sessão atualizada pelo middleware')
    return response
  } catch (error) {
    console.error('❌ Erro no middleware:', error)
    // Em caso de erro, continuar normalmente
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .*\\.(?:svg|png|jpg|jpeg|gif|webp)$ (image files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}