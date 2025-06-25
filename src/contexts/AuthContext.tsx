'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import toast from 'react-hot-toast'

interface User {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: 'clinic_admin' | 'clinic_viewer' | 'manager' | 'consultant'
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: SupabaseUser | null
  profile: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Função para buscar o perfil do usuário com DEBUG DETALHADO
  const fetchProfile = async (userId: string, retries = 3): Promise<User | null> => {
    try {
      console.log('🔍 === INICIANDO BUSCA DE PERFIL ===')
      console.log('🔍 User ID:', userId)
      console.log('🔍 Tentativas restantes:', retries)
      
      // Primeiro, vamos verificar se a tabela users existe e tem dados
      const { data: tableCheck, error: tableError } = await supabase
        .from('users')
        .select('count')

      console.log('🔍 Verificação da tabela users:', { tableCheck, tableError })

      if (tableError) {
        console.error('❌ ERRO: Tabela users não encontrada ou sem acesso:', tableError)
        console.error('❌ Código do erro:', tableError.code)
        console.error('❌ Mensagem:', tableError.message)
        return null
      }

      // Agora vamos buscar especificamente o usuário
      console.log('🔍 Buscando usuário específico...')
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      console.log('🔍 Resultado da busca:', { data, error })

      if (error) {
        console.error('❌ ERRO ao buscar perfil:')
        console.error('❌ Código:', error.code)
        console.error('❌ Mensagem:', error.message)
        console.error('❌ Detalhes:', error.details)
        console.error('❌ Hint:', error.hint)

        // Se o erro é "not found", vamos tentar criar o perfil
        if (error.code === 'PGRST116') {
          console.log('⚠️ Usuário não encontrado na tabela users, tentando criar...')
          return await createUserProfile(userId)
        }

        if (retries > 0) {
          console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchProfile(userId, retries - 1)
        }
        return null
      }

      if (!data) {
        console.log('⚠️ Dados retornados como null/undefined')
        if (retries > 0) {
          console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchProfile(userId, retries - 1)
        }
        return null
      }

      console.log('✅ Perfil encontrado com sucesso!')
      console.log('✅ Dados do perfil:', JSON.stringify(data, null, 2))
      return data
    } catch (error) {
      console.error('❌ CATCH: Erro na busca do perfil:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchProfile(userId, retries - 1)
      }
      return null
    }
  }

  // Função para criar perfil se não existir
  const createUserProfile = async (userId: string): Promise<User | null> => {
    try {
      console.log('🏗️ Tentando criar perfil para usuário:', userId)

      // Buscar dados do usuário auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('❌ Erro ao buscar dados do usuário auth:', authError)
        return null
      }

      console.log('🏗️ Dados do usuário auth:', {
        id: authUser.id,
        email: authUser.email,
        user_metadata: authUser.user_metadata,
        app_metadata: authUser.app_metadata
      })

      // Criar perfil básico
      const newProfile = {
        id: userId,
        email: authUser.email!,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
        phone: authUser.phone || null,
        role: 'consultant' as const,
        status: 'active' as const,
      }

      console.log('🏗️ Criando perfil com dados:', newProfile)

      const { data, error } = await supabase
        .from('users')
        .insert(newProfile)
        .select()
        .single()

      if (error) {
        console.error('❌ Erro ao criar perfil:', error)
        return null
      }

      console.log('✅ Perfil criado com sucesso:', data)
      return data
    } catch (error) {
      console.error('❌ Erro na criação do perfil:', error)
      return null
    }
  }

  // Função para verificar o usuário atual
  const checkUser = async () => {
    try {
      console.log('🔍 === INICIANDO VERIFICAÇÃO DE USUÁRIO ===')
      
      // Usar getUser() que é mais seguro e faz verificação no servidor
      const { data: { user }, error } = await supabase.auth.getUser()
      
      console.log('🔍 Resultado getUser:', { user: user?.id, error })

      if (error) {
        console.error('❌ Erro ao verificar usuário:', error)
        setUser(null)
        setProfile(null)
        return
      }

      console.log('👤 Usuário encontrado:', user?.id)
      setUser(user)
      
      if (user) {
        console.log('🔍 Iniciando busca do perfil...')
        const userProfile = await fetchProfile(user.id)
        console.log('🔍 Perfil retornado:', userProfile ? 'ENCONTRADO' : 'NÃO ENCONTRADO')
        setProfile(userProfile)
      } else {
        console.log('❌ Nenhum usuário encontrado')
        setProfile(null)
      }
    } catch (error) {
      console.error('❌ CATCH: Erro na verificação do usuário:', error)
      setUser(null)
      setProfile(null)
    }
  }

  // Inicialização do auth
  useEffect(() => {
    if (initialized) return

    console.log('🚀 === INICIALIZANDO AUTH CONTEXT ===')
    setInitialized(true)

    const initAuth = async () => {
      await checkUser()
      console.log('🏁 Finalizando loading inicial')
      setLoading(false)
    }

    initAuth()

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 === AUTH STATE CHANGED ===')
        console.log('🔄 Event:', event)
        console.log('🔄 Session user ID:', session?.user?.id)
        
        try {
          setUser(session?.user ?? null)
          
          if (session?.user) {
            console.log('🔄 Buscando perfil após mudança de estado...')
            const userProfile = await fetchProfile(session.user.id)
            console.log('🔄 Perfil após mudança:', userProfile ? 'ENCONTRADO' : 'NÃO ENCONTRADO')
            setProfile(userProfile)
          } else {
            console.log('🔄 Limpando perfil (sem usuário)')
            setProfile(null)
          }
        } catch (error) {
          console.error('❌ Erro na mudança de estado de auth:', error)
          setUser(null)
          setProfile(null)
        }
        
        console.log('🔄 Finalizando loading após mudança de estado')
        setLoading(false)
      }
    )

    return () => {
      console.log('🧹 Limpando subscription do auth')
      subscription.unsubscribe()
    }
  }, [initialized])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      console.log('🔑 === INICIANDO LOGIN ===')
      console.log('🔑 Email:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Erro no login:', error)
        throw error
      }

      if (data.user) {
        console.log('✅ Login realizado com sucesso!')
        console.log('✅ User ID:', data.user.id)
        toast.success('Login realizado com sucesso!')
        
        // Aguardar um pouco para garantir que o estado foi atualizado
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Só redirecionar se não estiver em uma página de auth
        if (pathname?.startsWith('/auth')) {
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      console.error('❌ Erro no login:', error)
      toast.error(error.message || 'Erro ao fazer login')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true)
      console.log('📝 === INICIANDO CADASTRO ===')
      console.log('📝 Email:', email)
      console.log('📝 Nome:', fullName)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        console.error('❌ Erro no cadastro:', error)
        throw error
      }

      if (data.user) {
        console.log('✅ Conta criada com sucesso!')
        console.log('✅ User ID:', data.user.id)
        
        toast.success('Conta criada com sucesso! Verifique seu email.')
      }
    } catch (error: any) {
      console.error('❌ Erro no cadastro:', error)
      toast.error(error.message || 'Erro ao criar conta')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      console.log('🚪 === INICIANDO LOGOUT ===')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Erro no logout:', error)
        throw error
      }

      console.log('✅ Logout realizado com sucesso!')
      
      // Limpar estados imediatamente
      setUser(null)
      setProfile(null)
      
      toast.success('Logout realizado com sucesso!')
      
      // Aguardar um pouco antes de redirecionar
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Force reload para limpar qualquer cache
      window.location.href = '/auth/login'
    } catch (error: any) {
      console.error('❌ Erro ao fazer logout:', error)
      toast.error(error.message || 'Erro ao fazer logout')
      setLoading(false)
      throw error
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      if (!user) throw new Error('Usuário não encontrado')

      console.log('📝 === ATUALIZANDO PERFIL ===')
      console.log('📝 Dados:', data)

      const { error } = await supabase
        .from('users')
        .update({
          ...data,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) {
        throw error
      }

      // Recarregar o perfil
      const updatedProfile = await fetchProfile(user.id)
      if (updatedProfile) {
        setProfile(updatedProfile)
      }
      
      console.log('✅ Perfil atualizado com sucesso!')
      toast.success('Perfil atualizado com sucesso!')
    } catch (error: any) {
      console.error('❌ Erro ao atualizar perfil:', error)
      toast.error(error.message || 'Erro ao atualizar perfil')
      throw error
    }
  }

  // Debug do estado atual
  useEffect(() => {
    console.log('📊 === ESTADO ATUAL ===')
    console.log('📊 Loading:', loading)
    console.log('📊 User:', user?.id)
    console.log('📊 Profile:', profile?.id)
    console.log('📊 Initialized:', initialized)
  }, [loading, user, profile, initialized])

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}