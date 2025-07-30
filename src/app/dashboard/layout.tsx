'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/dashboard/Sidebar'
import Header from '@/components/dashboard/Header'
import { motion } from 'framer-motion'

// Desabilitar cache para este layout
export const dynamic = 'force-dynamic'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    console.log('🏠 Dashboard Layout - Estado:', { 
      loading, 
      hasUser: !!user, 
      hasProfile: !!profile,
      profileRole: profile?.role 
    })

    // Se ainda está carregando, não fazer nada
    if (loading) {
      console.log('⏳ Ainda carregando...')
      return
    }

    // Se não tem usuário, redirecionar para login
    if (!user) {
      console.log('🚫 Sem usuário, redirecionando para login')
      router.replace('/auth/login')
      return
    }

    // Se tem usuário mas não tem perfil, aguardar um pouco
    if (user && !profile) {
      console.log('👤 Usuário sem perfil, aguardando...')
      const timeout = setTimeout(() => {
        // Se após 5 segundos ainda não tem perfil, pode ter problema
        if (!profile) {
          console.error('❌ Perfil não carregado após timeout')
          // Tentar recarregar a página como último recurso
          window.location.reload()
        }
      }, 5000)

      return () => clearTimeout(timeout)
    }

    // Se tem usuário E perfil, está pronto
    if (user && profile) {
      console.log('✅ Dashboard pronto!')
      setIsReady(true)
    }
  }, [user, profile, loading, router])

  // Mostrar loading enquanto verifica autenticação
  if (loading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-secondary-600">
            {loading ? 'Verificando autenticação...' : 'Carregando perfil...'}
          </p>
          {!loading && user && !profile && (
            <p className="text-sm text-secondary-500 mt-2">
              Aguarde enquanto carregamos seus dados...
            </p>
          )}
        </div>
      </div>
    )
  }

  // Se chegou aqui sem usuário ou perfil, algo deu errado
  if (!user || !profile) {
    console.error('❌ Estado inconsistente no dashboard layout')
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-secondary-900 mb-2">
            Erro de Autenticação
          </h2>
          <p className="text-secondary-600 mb-4">
            Houve um problema ao carregar seus dados.
          </p>
          <button
            onClick={() => {
              console.log('🔄 Forçando reload da página')
              window.location.href = '/auth/login'
            }}
            className="btn btn-primary"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex overflow-hidden bg-secondary-50">
      {/* Sidebar */}
      <Sidebar 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        userRole={profile.role}
      />

      {/* Main Content - Com padding left para o sidebar no desktop */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden md:pl-64">
        {/* Header */}
        <Header 
          setSidebarOpen={setSidebarOpen}
          user={profile}
        />

        {/* Page Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="py-6"
          >
            <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  )
}