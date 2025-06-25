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

  // Função para buscar o perfil do usuário
  const fetchProfile = async (userId: string, retries = 3): Promise<User | null> => {
    try {
      console.log('🔍 Buscando perfil para usuário:', userId)
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Erro ao buscar perfil:', error)
        if (retries > 0) {
          console.log(`🔄 Tentando novamente... (${retries} tentativas restantes)`)
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchProfile(userId, retries - 1)
        }
        return null
      }

      console.log('✅ Perfil encontrado:', data)
      return data
    } catch (error) {
      console.error('❌ Erro na busca do perfil:', error)
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return fetchProfile(userId, retries - 1)
      }
      return null
    }
  }

  // Função para verificar o usuário atual
  const checkUser = async () => {
    try {
      console.log('🔍 Verificando usuário atual...')
      
      // Usar getUser() que é mais seguro e faz verificação no servidor
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        console.error('❌ Erro ao verificar usuário:', error)
        setUser(null)
        setProfile(null)
        return
      }

      console.log('👤 Usuário encontrado:', user?.id)
      setUser(user)
      
      if (user) {
        const userProfile = await fetchProfile(user.id)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }
    } catch (error) {
      console.error('❌ Erro na verificação do usuário:', error)
      setUser(null)
      setProfile(null)
    }
  }

  // Inicialização do auth
  useEffect(() => {
    if (initialized) return

    console.log('🚀 Inicializando AuthContext...')
    setInitialized(true)

    const initAuth = async () => {
      await checkUser()
      setLoading(false)
    }

    initAuth()

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', event, session?.user?.id)
        
        try {
          setUser(session?.user ?? null)
          
          if (session?.user) {
            const userProfile = await fetchProfile(session.user.id)
            setProfile(userProfile)
          } else {
            setProfile(null)
          }
        } catch (error) {
          console.error('❌ Erro na mudança de estado de auth:', error)
          setUser(null)
          setProfile(null)
        }
        
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
      console.log('🔑 Tentando fazer login...')
      
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
      console.log('📝 Tentando criar conta...')
      
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
        
        // Aguardar um pouco antes de criar o perfil
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Criar perfil do usuário
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            role: 'consultant',
            status: 'pending',
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (profileError) {
          console.error('❌ Erro ao criar perfil:', profileError)
        }

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
      console.log('🚪 Fazendo logout...')
      
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

      console.log('📝 Atualizando perfil...')

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