// src/contexts/AuthContext.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
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
console.log('🔐 AUTHCONTEXT CARREGADO!')

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('🔐 AUTHPROVIDER INICIANDO!')
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Verificar usuário atual
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        await fetchProfile(user.id)
      }
      
      setLoading(false)
    }

    getUser()

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Erro ao buscar perfil:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil:', error)
    }
  }

 const signIn = async (email: string, password: string) => {
  try {
    setLoading(true)
    console.log('🔐 Iniciando login com:', { email, password: '***' })
    
    const supabase = createClient()
    console.log('🔐 Cliente Supabase criado para login')
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    console.log('🔐 Resposta do signInWithPassword:', { data, error })

    if (error) {
      console.error('🔐 Erro no signInWithPassword:', error)
      throw error
    }

    if (data.user) {
      console.log('🔐 Login bem-sucedido! Usuário:', data.user)
      toast.success('Login realizado com sucesso!')
      router.push('/dashboard')
    }
  } catch (error: any) {
    console.error('🔐 Erro completo no login:', error)
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
        // Criar perfil do usuário
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email!,
            full_name: fullName,
            role: 'consultant', // Role padrão
            status: 'pending',
          })

        if (profileError) {
          console.error('Erro ao criar perfil:', profileError)
        }

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

      setUser(null)
      setProfile(null)
      toast.success('Logout realizado com sucesso!')
      router.push('/auth/login')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      if (!user) throw new Error('Usuário não encontrado')

      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', user.id)

      if (error) {
        throw error
      }

      await fetchProfile(user.id)
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