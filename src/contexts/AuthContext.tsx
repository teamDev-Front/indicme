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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Se o erro é "not found", tentar criar o perfil
        if (error.code === 'PGRST116') {
          return await createUserProfile(userId)
        }

        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          return fetchProfile(userId, retries - 1)
        }
        return null
      }

      return data
    } catch (error) {
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
      // Buscar dados do usuário auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        return null
      }

      // Criar perfil básico
      const newProfile = {
        id: userId,
        email: authUser.email!,
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
        phone: authUser.phone || null,
        role: 'consultant' as const,
        status: 'active' as const,
      }

      const { data, error } = await supabase
        .from('users')
        .insert(newProfile)
        .select()
        .single()

      if (error) {
        return null
      }

      return data
    } catch (error) {
      return null
    }
  }

  // Função para verificar o usuário atual
  const checkUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) {
        setUser(null)
        setProfile(null)
        return
      }

      setUser(user)
      
      if (user) {
        const userProfile = await fetchProfile(user.id)
        setProfile(userProfile)
      } else {
        setProfile(null)
      }
    } catch (error) {
      setUser(null)
      setProfile(null)
    }
  }

  // Inicialização do auth
  useEffect(() => {
    if (initialized) return

    setInitialized(true)

    const initAuth = async () => {
      await checkUser()
      setLoading(false)
    }

    initAuth()

    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setUser(session?.user ?? null)
          
          if (session?.user) {
            const userProfile = await fetchProfile(session.user.id)
            setProfile(userProfile)
          } else {
            setProfile(null)
          }
        } catch (error) {
          setUser(null)
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initialized])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.user) {
        toast.success('Login realizado com sucesso!')
        
        // Aguardar a atualização do estado via onAuthStateChange
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Forçar redirecionamento
        window.location.href = '/dashboard'
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setLoading(true)
      
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
        throw error
      }

      if (data.user) {
        toast.success('Conta criada com sucesso! Verifique seu email.')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }

      // Limpar estados imediatamente
      setUser(null)
      setProfile(null)
      
      toast.success('Logout realizado com sucesso!')
      
      // Force reload para limpar qualquer cache
      window.location.href = '/auth/login'
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout')
      setLoading(false)
      throw error
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      if (!user) throw new Error('Usuário não encontrado')

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
      
      toast.success('Perfil atualizado com sucesso!')
    } catch (error: any) {
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