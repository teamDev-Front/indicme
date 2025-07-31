'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { 
  EyeIcon, 
  EyeSlashIcon, 
  CheckCircleIcon, 
  KeyIcon,
  ArrowLeftIcon 
} from '@heroicons/react/24/outline'
import LogoIndicMe from '@/public/logo4.png'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isCheckingToken, setIsCheckingToken] = useState(true)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // Verificar token na URL
  useEffect(() => {
    const checkToken = async () => {
      try {
        setIsCheckingToken(true)
        
        // O Supabase automaticamente processa o token da URL
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Erro ao verificar token:', error)
          setIsValidToken(false)
          toast.error('Link de recuperação inválido ou expirado')
        } else if (session) {
          setIsValidToken(true)
        } else {
          setIsValidToken(false)
          toast.error('Link de recuperação inválido ou expirado')
        }
      } catch (error) {
        console.error('Erro ao verificar token:', error)
        setIsValidToken(false)
        toast.error('Erro ao verificar link de recuperação')
      } finally {
        setIsCheckingToken(false)
      }
    }

    checkToken()
  }, [supabase])

  // Calcular força da senha
  useEffect(() => {
    let strength = 0
    
    if (password.length >= 6) strength += 1
    if (password.length >= 8) strength += 1
    if (/[A-Z]/.test(password)) strength += 1
    if (/[0-9]/.test(password)) strength += 1
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    
    setPasswordStrength(strength)
  }, [password])

  const getPasswordStrengthText = () => {
    switch (passwordStrength) {
      case 0:
      case 1: return { text: 'Muito fraca', color: 'text-danger-600' }
      case 2: return { text: 'Fraca', color: 'text-warning-600' }
      case 3: return { text: 'Média', color: 'text-warning-600' }
      case 4: return { text: 'Forte', color: 'text-success-600' }
      case 5: return { text: 'Muito forte', color: 'text-success-600' }
      default: return { text: '', color: '' }
    }
  }

  const getPasswordStrengthWidth = () => {
    return (passwordStrength / 5) * 100
  }

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-danger-500'
    if (passwordStrength <= 2) return 'bg-warning-500'
    if (passwordStrength <= 3) return 'bg-warning-400'
    return 'bg-success-500'
  }

  const validateForm = () => {
    if (!password) {
      toast.error('Nova senha é obrigatória')
      return false
    }
    
    if (password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return false
    }
    
    if (password !== confirmPassword) {
      toast.error('Senhas não coincidem')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setIsLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        throw error
      }

      setPasswordChanged(true)
      toast.success('Senha alterada com sucesso!')
      
      // Redirecionar após 3 segundos
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)

    } catch (error: any) {
      console.error('Erro ao redefinir senha:', error)
      toast.error(error.message || 'Erro ao redefinir senha')
    } finally {
      setIsLoading(false)
    }
  }

  // Tela de carregamento
  if (isCheckingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando link de recuperação...</p>
        </div>
      </div>
    )
  }

  // Tela de token inválido
  if (!isValidToken) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Image src={LogoIndicMe} alt="Logo IndicMe" width={150} height={150} />
                </div>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-danger-100 mb-6">
                  <KeyIcon className="h-8 w-8 text-danger-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                  Link Inválido
                </h2>
                <p className="text-secondary-600 mb-8">
                  Este link de recuperação é inválido ou expirou. Solicite um novo link de recuperação.
                </p>
                
                <div className="space-y-4">
                  <Link
                    href="/auth/forgot-password"
                    className="btn btn-primary w-full"
                  >
                    Solicitar Novo Link
                  </Link>
                  
                  <Link
                    href="/auth/login"
                    className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
                  >
                    <ArrowLeftIcon className="h-4 w-4 mr-2" />
                    Voltar ao login
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background lado direito */}
        <div className="hidden lg:block relative w-0 flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-danger-500 to-danger-700">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative h-full flex flex-col justify-center items-center text-white p-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-center"
              >
                <KeyIcon className="w-24 h-24 mx-auto mb-6 text-white/90" />
                <h1 className="text-4xl font-bold mb-4">
                  Link Expirado
                </h1>
                <p className="text-xl text-white/90 mb-8 max-w-md">
                  Por segurança, os links de recuperação têm validade limitada
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Tela de sucesso
  if (passwordChanged) {
    return (
      <div className="min-h-screen flex">
        <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm lg:w-96">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Image src={LogoIndicMe} alt="Logo IndicMe" width={150} height={150} />
                </div>
              </div>

              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
                  <CheckCircleIcon className="h-8 w-8 text-success-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                  Senha Alterada!
                </h2>
                <p className="text-secondary-600 mb-8">
                  Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes.
                </p>
                
                <div className="space-y-4">
                  <Link
                    href="/auth/login"
                    className="btn btn-primary w-full"
                  >
                    Ir para Login
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Background lado direito */}
        <div className="hidden lg:block relative w-0 flex-1">
          <div className="absolute inset-0 bg-gradient-to-br from-success-500 to-success-700">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="relative h-full flex flex-col justify-center items-center text-white p-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-center"
              >
                <CheckCircleIcon className="w-24 h-24 mx-auto mb-6 text-white/90" />
                <h1 className="text-4xl font-bold mb-4">
                  Senha Atualizada
                </h1>
                <p className="text-xl text-white/90 mb-8 max-w-md">
                  Sua conta está protegida com a nova senha
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Formulário de redefinição
  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <Image src={LogoIndicMe} alt="Logo IndicMe" width={150} height={150} />
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-secondary-900 text-center mb-2">
                Nova Senha
              </h2>
              <p className="text-secondary-600 text-center mb-8">
                Digite sua nova senha para recuperar o acesso à sua conta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-4 w-4 text-secondary-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-secondary-400" />
                    )}
                  </button>
                </div>
                
                {password && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-secondary-500">Força da senha:</span>
                      <span className={getPasswordStrengthText().color}>
                        {getPasswordStrengthText().text}
                      </span>
                    </div>
                    <div className="w-full bg-secondary-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                        style={{ width: `${getPasswordStrengthWidth()}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    className="input pr-10"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-4 w-4 text-secondary-400" />
                    ) : (
                      <EyeIcon className="h-4 w-4 text-secondary-400" />
                    )}
                  </button>
                </div>
                
                {confirmPassword && (
                  <div className="mt-2 flex items-center">
                    {password === confirmPassword ? (
                      <div className="flex items-center text-success-600">
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        <span className="text-xs">Senhas coincidem</span>
                      </div>
                    ) : (
                      <span className="text-xs text-danger-600">Senhas não coincidem</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !password || password !== confirmPassword}
                  className="btn btn-primary w-full btn-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-5 h-5 mr-2"></div>
                      Alterando senha...
                    </>
                  ) : (
                    <>
                      <KeyIcon className="h-5 w-5 mr-2" />
                      Alterar Senha
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <Link
                href="/auth/login"
                className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Voltar ao login
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Background lado direito */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-700">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative h-full flex flex-col justify-center items-center text-white p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <KeyIcon className="w-24 h-24 mx-auto mb-6 text-white/90" />
              
              <h1 className="text-4xl font-bold mb-4">
                Recuperação Segura
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-md">
                Defina uma nova senha forte para proteger sua conta
              </p>
              
              <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Criptografia de ponta a ponta</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Proteção contra ataques</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Acesso seguro garantido</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}