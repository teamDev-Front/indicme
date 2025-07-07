'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { EyeIcon, EyeSlashIcon, UserIcon, EnvelopeIcon, PhoneIcon, CheckCircleIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import LogoIndicMe from '@/public/logo4.png'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { createClient } from '@/utils/supabase/client'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    establishmentCode: '', // NOVO CAMPO
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [establishmentInfo, setEstablishmentInfo] = useState<{
    name: string
    description?: string
  } | null>(null)
  const [validatingCode, setValidatingCode] = useState(false)
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

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

  // Validar código do estabelecimento
  useEffect(() => {
    const validateEstablishmentCode = async () => {
      if (formData.establishmentCode.length === 6) {
        setValidatingCode(true)
        try {
          const { data, error } = await supabase
            .from('establishment_codes')
            .select('name, description')
            .eq('code', formData.establishmentCode.toUpperCase())
            .eq('is_active', true)
            .single()

          if (error || !data) {
            setEstablishmentInfo(null)
            toast.error('Código do estabelecimento inválido')
          } else {
            setEstablishmentInfo(data)
          }
        } catch (error) {
          setEstablishmentInfo(null)
        } finally {
          setValidatingCode(false)
        }
      } else {
        setEstablishmentInfo(null)
      }
    }

    const debounceTimer = setTimeout(validateEstablishmentCode, 500)
    return () => clearTimeout(debounceTimer)
  }, [formData.establishmentCode, supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'establishmentCode' ? value.toUpperCase() : value
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

    if (!formData.establishmentCode.trim()) {
      toast.error('Código do estabelecimento é obrigatório')
      return false
    }

    if (formData.establishmentCode.length !== 6) {
      toast.error('Código do estabelecimento deve ter 6 caracteres')
      return false
    }

    if (!establishmentInfo) {
      toast.error('Código do estabelecimento inválido')
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

      // 1. Verificar se o estabelecimento ainda existe e está ativo
      const { data: establishment, error: estError } = await supabase
        .from('establishment_codes')
        .select('code, name')
        .eq('code', formData.establishmentCode)
        .eq('is_active', true)
        .single()

      if (estError || !establishment) {
        throw new Error('Estabelecimento não encontrado ou inativo')
      }

      // 2. Buscar o gerente responsável pelo estabelecimento
     const { data: managerData, error: managerError } = await supabase
        .from('user_establishments')
        .select(`
          user_id,
          users!user_establishments_user_id_fkey!inner (
            id,
            full_name,
            role
          )
        `)
        .eq('establishment_code', establishment.code)
        .eq('status', 'active')
        .eq('users.role', 'manager')

      if (managerError) {
        console.error('Erro ao buscar gerente:', managerError)
        throw new Error('Erro ao buscar gerente do estabelecimento')
      }

      if (!managerData || managerData.length === 0) {
        throw new Error('Nenhum gerente encontrado para este estabelecimento')
      }

      const managerId = managerData[0].user_id

      // 3. Buscar a clínica do gerente
      const { data: userClinic, error: clinicError } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', managerId)
        .single()

      if (clinicError || !userClinic) {
        throw new Error('Clínica não encontrada para o gerente')
      }

      // 4. Criar usuário no auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { 
            full_name: formData.fullName,
            establishment_code: formData.establishmentCode
          }
        }
      })

      if (signUpError) throw signUpError

      if (!signUpData.user) {
        throw new Error('Usuário não foi criado corretamente')
      }

      const newUserId = signUpData.user.id

      // 5. Aguardar propagação
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 6. Criar perfil como CONSULTOR
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: newUserId,
          email: formData.email,
          full_name: formData.fullName,
          phone: formData.phone || null,
          role: 'consultant', // SEMPRE CONSULTOR
          status: 'active',
        })

      if (profileError) {
        // Se der erro de duplicata, tentar update
        if (profileError.code === '23505') {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              email: formData.email,
              full_name: formData.fullName,
              phone: formData.phone || null,
              role: 'consultant',
              status: 'active',
              updated_at: new Date().toISOString()
            })
            .eq('id', newUserId)

          if (updateError) throw updateError
        } else {
          throw profileError
        }
      }

      // 7. Associar à clínica
      const { error: clinicAssocError } = await supabase
        .from('user_clinics')
        .insert({
          user_id: newUserId,
          clinic_id: userClinic.clinic_id,
        })

      if (clinicAssocError && clinicAssocError.code !== '23505') {
        throw clinicAssocError
      }

      // 8. Criar hierarquia (vincular ao gerente)
      const { error: hierarchyError } = await supabase
        .from('hierarchies')
        .insert({
          manager_id: managerId,
          consultant_id: newUserId,
          clinic_id: userClinic.clinic_id,
        })

      if (hierarchyError && hierarchyError.code !== '23505') {
        throw hierarchyError
      }

      // 9. Vincular ao estabelecimento
      const { error: establishmentError } = await supabase
        .from('user_establishments')
        .insert({
          user_id: newUserId,
          establishment_code: establishment.code,
          status: 'active',
          added_by: managerId // Adicionado pelo gerente
        })

      if (establishmentError && establishmentError.code !== '23505') {
        throw establishmentError
      }

      toast.success(`Conta criada com sucesso! Você foi vinculado ao estabelecimento ${establishment.name}.`)
      
      // Fazer login automático
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (signInError) {
        toast.error('Conta criada, mas houve erro no login automático. Faça login manualmente.')
        router.push('/auth/login')
      } else {
        router.push('/dashboard')
      }

    } catch (error: any) {
      console.error('Erro no cadastro:', error)
      
      if (error.message.includes('Estabelecimento não encontrado')) {
        toast.error('Código do estabelecimento inválido ou inativo')
      } else if (error.message.includes('Nenhum gerente encontrado')) {
        toast.error('Este estabelecimento não possui um gerente responsável')
      } else if (error.message.includes('already registered')) {
        toast.error('Este email já está cadastrado no sistema')
      } else {
        toast.error(`Erro ao criar conta: ${error.message}`)
      }
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
                Cadastre-se como consultor do estabelecimento
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Código do Estabelecimento - PRIMEIRO CAMPO */}
              <div>
                <label htmlFor="establishmentCode" className="block text-sm font-medium text-secondary-700 mb-2">
                  Código do Estabelecimento *
                </label>
                <div className="relative">
                  <input
                    id="establishmentCode"
                    name="establishmentCode"
                    type="text"
                    maxLength={6}
                    className="input pl-10 uppercase"
                    placeholder="ABC123"
                    value={formData.establishmentCode}
                    onChange={handleInputChange}
                    required
                  />
                  <BuildingOfficeIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                  {validatingCode && (
                    <div className="absolute right-3 top-3">
                      <div className="loading-spinner w-4 h-4"></div>
                    </div>
                  )}
                </div>
                
                {/* Feedback do código */}
                {formData.establishmentCode.length === 6 && !validatingCode && (
                  <div className="mt-2">
                    {establishmentInfo ? (
                      <div className="bg-success-50 border border-success-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <CheckCircleIcon className="h-4 w-4 text-success-500 mr-2" />
                          <div>
                            <p className="text-sm font-medium text-success-900">
                              {establishmentInfo.name}
                            </p>
                            {establishmentInfo.description && (
                              <p className="text-xs text-success-700">
                                {establishmentInfo.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-danger-600">
                        Código inválido ou estabelecimento inativo
                      </p>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-secondary-500 mt-1">
                  Código fornecido pelo seu gerente (6 caracteres)
                </p>
              </div>

              {/* Nome Completo */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-secondary-700 mb-2">
                  Nome Completo *
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
                  Email *
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
                  Senha *
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
                  Confirmar Senha *
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

              {/* Info sobre cadastro como consultor */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <strong>Sobre seu cadastro:</strong> Você será registrado como consultor do estabelecimento e automaticamente vinculado ao gerente responsável.
                </p>
              </div>

              {/* Botão de Cadastro */}
              <div>
                <button
                  type="submit"
                  disabled={isLoading || !establishmentInfo}
                  className="btn btn-primary w-full btn-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-5 h-5 mr-2"></div>
                      Criando conta...
                    </>
                  ) : (
                    'Criar conta como consultor'
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
              <div className="mb-8">
                <BuildingOfficeIcon className="w-24 h-24 mx-auto mb-6 text-white/90" />
              </div>
              
              <h1 className="text-4xl font-bold mb-4">
                Torne-se um Consultor
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-md">
                Cadastre-se com o código do seu estabelecimento e comece a gerar indicações
              </p>
              
              <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Vinculação automática ao estabelecimento</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Gerenciamento pela sua equipe</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Sistema de comissões automático</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Interface moderna e responsiva</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Suporte técnico especializado</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}