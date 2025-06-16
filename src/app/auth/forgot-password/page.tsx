'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeftIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import LogoIndicMe from '@/public/logo4.png'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast.error('Por favor, digite seu email')
      return
    }

    try {
      setIsLoading(true)
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        throw error
      }

      setEmailSent(true)
      toast.success('Email de recuperação enviado!')
    } catch (error: any) {
      console.error('Erro ao enviar email de recuperação:', error)
      toast.error(error.message || 'Erro ao enviar email de recuperação')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendEmail = async () => {
    try {
      setIsLoading(true)
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        throw error
      }

      toast.success('Email reenviado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao reenviar email:', error)
      toast.error('Erro ao reenviar email')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex">
        {/* Lado esquerdo - Confirmação */}
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

              {/* Success Message */}
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-success-100 mb-6">
                  <CheckCircleIcon className="h-8 w-8 text-success-600" />
                </div>
                
                <h2 className="text-2xl font-bold text-secondary-900 mb-2">
                  Email Enviado!
                </h2>
                <p className="text-secondary-600 mb-8">
                  Enviamos um link de recuperação para:
                </p>
                
                <div className="bg-secondary-50 rounded-lg p-4 mb-8">
                  <div className="flex items-center justify-center">
                    <EnvelopeIcon className="h-5 w-5 text-secondary-400 mr-2" />
                    <span className="font-medium text-secondary-900">{email}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-secondary-500">
                    Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                  </p>
                  
                  <p className="text-sm text-secondary-500">
                    Não recebeu o email? Verifique a pasta de spam ou:
                  </p>
                  
                  <button
                    onClick={handleResendEmail}
                    disabled={isLoading}
                    className="btn btn-secondary w-full"
                  >
                    {isLoading ? (
                      <>
                        <div className="loading-spinner w-4 h-4 mr-2"></div>
                        Reenviando...
                      </>
                    ) : (
                      'Reenviar Email'
                    )}
                  </button>
                </div>
              </div>

              {/* Back to Login */}
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
                  <CheckCircleIcon className="w-24 h-24 mx-auto mb-6 text-white/90" />
                </div>
                
                <h1 className="text-4xl font-bold mb-4">
                  Recuperação Enviada
                </h1>
                <p className="text-xl text-white/90 mb-8 max-w-md">
                  Verifique seu email e siga as instruções para redefinir sua senha
                </p>
                
                <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span>Link válido por 24 horas</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span>Acesso seguro e criptografado</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                    <span>Suporte disponível 24/7</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    )
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
                Esqueceu sua senha?
              </h2>
              <p className="text-secondary-600 text-center mb-8">
                Digite seu email e enviaremos um link para redefinir sua senha
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <EnvelopeIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="btn btn-primary w-full btn-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="loading-spinner w-5 h-5 mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <EnvelopeIcon className="h-5 w-5 mr-2" />
                      Enviar Link de Recuperação
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Help Text */}
            <div className="mt-6">
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-primary-900 mb-2">
                  Como funciona?
                </h4>
                <div className="space-y-2 text-sm text-primary-700">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></div>
                    <span>Você receberá um email com um link seguro</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></div>
                    <span>Clique no link para criar uma nova senha</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-primary-500 rounded-full mt-2"></div>
                    <span>O link expira em 24 horas por segurança</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Back to Login */}
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

      {/* Lado direito - Background */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-warning-500 to-warning-700">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative h-full flex flex-col justify-center items-center text-white p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-center"
            >
              <div className="mb-8">
                <div className="w-24 h-24 mx-auto mb-6 relative">
                  <div className="absolute inset-0">
                    <EnvelopeIcon className="w-full h-full text-white/90" />
                  </div>
                </div>
              </div>
              
              <h1 className="text-4xl font-bold mb-4">
                Recuperação Segura
              </h1>
              <p className="text-xl text-white/90 mb-8 max-w-md">
                Recupere o acesso à sua conta de forma rápida e segura
              </p>
              
              <div className="grid grid-cols-1 gap-4 text-left max-w-sm">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Processo 100% seguro</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Link temporário criptografado</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Suporte técnico disponível</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span>Recuperação em minutos</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}