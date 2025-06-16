'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { EyeIcon, EyeSlashIcon, UserIcon, EnvelopeIcon, PhoneIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import LogoIndicMe from '@/public/logo4.png'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const { signUp, user } = useAuth()
  const router = useRouter()

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  // Calcular força da senha
  useEffect(() => {
    const password = formData.password
    let strength = 0
    
    if (password.length >= 6) strength += 1
    if (password.length >= 8) strength += 1
    if (/[A-Z]/.test(password)) strength += 1
    if (/[0-9]/.test(password)) strength += 1
    if (/[^A-Za-z0-9]/.test(password)) strength += 1
    
    setPasswordStrength(strength)
  }, [formData.password])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

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
    if (!formData.fullName.trim()) {
      toast.error('Nome completo é obrigatório')
      return false
    }
    
    if (!formData.email.trim()) {
      toast.error('Email é obrigatório')
      return false
    }
    
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      toast.error('Email inválido')
      return false
    }
    
    if (!formData.password) {
      toast.error('Senha é obrigatória')
      return false
    }
    
    if (formData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Senhas não coincidem')
      return false
    }
    
    if (!acceptedTerms) {
      toast.error('Você deve aceitar os termos de uso')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      setIsLoading(true)
      await signUp(formData.email, formData.password, formData.fullName)
      // O redirecionamento será feito automaticamente pelo contexto
    } catch (error) {
      console.error('Erro no cadastro:', error)
      // O erro já será tratado no contexto
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo - Formulário */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <Image src={LogoIndicMe} alt="Logo IndicMe" width={150} height={150} />
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-secondary-900 text-center mb-2">
                Criar conta
              </h2>
              <p className="text-secondary-600 text-center mb-8">
                Junte-se ao IndicMe e comece a gerar indicações
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome Completo */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-secondary-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    className="input pl-10"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input pl-10"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                  <EnvelopeIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                </div>
              </div>

              {/* Telefone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-2">
                  Telefone (opcional)
                </label>
                <div className="relative">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    className="input pl-10"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                  <PhoneIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                </div>
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 mb-2">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="input pr-10"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleInputChange}
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
                
                {/* Indicador de força da senha */}
                {formData.password && (
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

              {/* Confirmar Senha */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary-700 mb-2">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="input pr-10"
                    placeholder="Digite a senha novamente"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
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
                
                {/* Indicador de senhas iguais */}
                {formData.confirmPassword && (
                  <div className="mt-2 flex items-center">
                    {formData.password === formData.confirmPassword ? (
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

              {/* Termos de Uso */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    name="terms"
                    type="checkbox"
                    className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-secondary-300 rounded"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="terms" className="text-secondary-700">
                    Eu aceito os{' '}
                    <Link href="/terms" className="font-medium text-primary-600 hover:text-primary-500">
                      Termos de Uso
                    </Link>{' '}
                    e{' '}
                    <Link href="/privacy" className="font-medium text-primary-600 hover:text-primary-500">
                      Política de Privacidade
                    </Link>
                  </label>
                </div>
              </div>

              {/* Botão de Cadastro */}
              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-full btn-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-5 h-5 mr-2"></div>
                      Criando conta...
                    </>
                  ) : (
                    'Criar conta'
                  )}
                </button>
              </div>

              {/* Link para Login */}
              <div className="text-center">
                <p className="text-sm text-secondary-600">
                  Já tem uma conta?{' '}
                  <Link
                    href="/auth/login"
                    className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
                  >
                    Faça login aqui
                  </Link>
                </p>
              </div>
            </form>

            
          </motion.div>
        </div>
      </div>

      {/* Lado direito - Background */}
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
              <div className="mb-2">
                <div className="w-24 h-24 mx-auto mb-6 relative">
                  <div className="absolute inset-0">
                    <div className="w-full h-full border-4 border-white/30 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-4 border-white/50 rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-4 border-white rounded-full"></div>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <h1 className="text-4xl font-bold mb-4">
                Junte-se ao IndicMe
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-md">
                Milhares de consultores já confiam na nossa plataforma para gerenciar suas indicações
              </p>
              
              <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Cadastro rápido e gratuito</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Interface intuitiva e moderna</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Suporte técnico especializado</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Segurança garantida dos dados</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Relatórios em tempo real</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}