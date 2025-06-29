// src/components/consultants/CreateConsultantModal.tsx - VERSÃO CORRIGIDA
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  UserPlusIcon,
  BuildingOfficeIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface CreateConsultantModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ManagerEstablishment {
  code: string
  name: string
  description?: string
}

export default function CreateConsultantModal({
  isOpen,
  onClose,
  onSuccess
}: CreateConsultantModalProps) {
  const { profile } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  })
  const [managerEstablishment, setManagerEstablishment] = useState<ManagerEstablishment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingEstablishment, setLoadingEstablishment] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && profile?.role === 'manager') {
      fetchManagerEstablishment()
    }
  }, [isOpen, profile])

  const fetchManagerEstablishment = async () => {
    try {
      setLoadingEstablishment(true)
      console.log('🔍 Buscando estabelecimento do gerente:', profile?.id)

      const { data: userEstablishment, error } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            code,
            name,
            description
          )
        `)
        .eq('user_id', profile?.id)
        .eq('status', 'active')
        .single() // Um gerente deve ter apenas um estabelecimento

      if (error) {
        console.error('Erro ao buscar estabelecimento do gerente:', error)
        toast.error('Você não está vinculado a nenhum estabelecimento ativo')
        onClose()
        return
      }

      if (!userEstablishment?.establishment_codes) {
        toast.error('Estabelecimento não encontrado')
        onClose()
        return
      }

      const establishment = Array.isArray(userEstablishment.establishment_codes)
        ? userEstablishment.establishment_codes[0]
        : userEstablishment.establishment_codes

      setManagerEstablishment({
        code: establishment.code,
        name: establishment.name,
        description: establishment.description
      })

      console.log('✅ Estabelecimento do gerente encontrado:', establishment.name)
    } catch (error) {
      console.error('Erro ao buscar estabelecimento:', error)
      toast.error('Erro ao carregar estabelecimento')
      onClose()
    } finally {
      setLoadingEstablishment(false)
    }
  }

  const handleCreateConsultant = async () => {
    if (!profile) {
      toast.error('Usuário não autenticado')
      return
    }

    if (!managerEstablishment) {
      toast.error('Estabelecimento não identificado')
      return
    }

    try {
      setSubmitting(true)

      // 1. Buscar clínica do gerente
      const { data: userClinic, error: clinicError } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile.id)
        .single()

      if (clinicError || !userClinic) {
        throw new Error('Clínica não encontrada. Verifique se você está associado a uma clínica.')
      }

      console.log('✅ Clínica encontrada:', userClinic.clinic_id)

      // 2. Criar usuário no auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.full_name }
        }
      })

      if (signUpError) throw signUpError

      if (!signUpData.user) {
        throw new Error('Usuário não foi criado corretamente')
      }

      const newUserId = signUpData.user.id
      console.log('✅ Usuário criado no auth:', newUserId)

      // 3. Aguardar propagação
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 4. Criar perfil com retry
      let profileCreated = false
      let retries = 3

      while (!profileCreated && retries > 0) {
        try {
          const { error: profileError } = await supabase
            .from('users')
            .upsert({
              id: newUserId,
              email: formData.email,
              full_name: formData.full_name,
              phone: formData.phone || null,
              role: 'consultant',
              status: 'active',
            }, {
              onConflict: 'id'
            })

          if (profileError) {
            console.warn(`Tentativa ${4 - retries} falhou:`, profileError)
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
            throw profileError
          }

          profileCreated = true
          console.log('✅ Perfil criado com sucesso')
        } catch (error) {
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // 5. Associar à clínica com retry
      let clinicAssociated = false
      retries = 3

      while (!clinicAssociated && retries > 0) {
        try {
          const { error: clinicAssocError } = await supabase
            .from('user_clinics')
            .upsert({
              user_id: newUserId,
              clinic_id: userClinic.clinic_id,
            }, {
              onConflict: 'user_id,clinic_id'
            })

          if (clinicAssocError) {
            console.warn(`Associação clínica tentativa ${4 - retries} falhou:`, clinicAssocError)
            retries--
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              continue
            }
            throw clinicAssocError
          }

          clinicAssociated = true
          console.log('✅ Usuário associado à clínica')
        } catch (error) {
          retries--
          if (retries === 0) throw error
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }

      // 6. Criar hierarquia (consultor vinculado ao gerente)
      const { error: hierarchyError } = await supabase
        .from('hierarchies')
        .upsert({
          manager_id: profile.id,
          consultant_id: newUserId,
          clinic_id: userClinic.clinic_id,
        }, {
          onConflict: 'manager_id,consultant_id'
        })

      if (hierarchyError) {
        console.warn('Erro ao criar hierarquia:', hierarchyError)
        toast.error('Consultor criado, mas não foi vinculado à sua equipe')
      } else {
        console.log('✅ Hierarquia criada - consultor vinculado ao gerente')
      }

      // 7. Vincular ao estabelecimento do gerente (ÚNICO estabelecimento)
      const { error: establishmentError } = await supabase
        .from('user_establishments')
        .insert({
          user_id: newUserId,
          establishment_code: managerEstablishment.code,
          status: 'active',
          added_by: profile.id
        })

      if (establishmentError) {
        console.warn('Erro ao vincular ao estabelecimento:', establishmentError)
        toast.error('Consultor criado, mas houve problema ao vincular ao estabelecimento')
      } else {
        console.log('✅ Consultor vinculado ao estabelecimento:', managerEstablishment.name)
      }

      toast.success(`Consultor criado e vinculado ao estabelecimento ${managerEstablishment.name}!`)

      // Resetar form
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: ''
      })

      onClose()
      onSuccess()

    } catch (error: any) {
      console.error('❌ Erro completo ao criar consultor:', error)

      if (error.message.includes('Clínica não encontrada')) {
        toast.error('Erro: Você não está associado a uma clínica. Contate o administrador.')
      } else if (error.message.includes('already registered')) {
        toast.error('Este email já está cadastrado no sistema.')
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciais inválidas. Verifique email e senha.')
      } else {
        toast.error(`Erro ao criar consultor: ${error.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                  Adicionar Consultor à Minha Equipe
                </Dialog.Title>

                {loadingEstablishment ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="loading-spinner w-6 h-6 mr-3"></div>
                    <span className="text-secondary-600">Carregando estabelecimento...</span>
                  </div>
                ) : managerEstablishment ? (
                  <div className="space-y-6">
                    {/* Estabelecimento do Gerente (Fixo) */}
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <BuildingOfficeIcon className="h-5 w-5 text-primary-500 mr-3 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-primary-900">Estabelecimento</h4>
                          <p className="text-sm text-primary-700 font-medium mt-1">
                            {managerEstablishment.name}
                          </p>
                          <p className="text-xs text-primary-600 mt-1">
                            Código: {managerEstablishment.code}
                          </p>
                          {managerEstablishment.description && (
                            <p className="text-xs text-primary-600 mt-1">
                              {managerEstablishment.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dados do Consultor */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-secondary-900">Dados do Consultor</h4>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Nome Completo *
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formData.full_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Nome completo do consultor"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Email *
                          </label>
                          <input
                            type="email"
                            className="input"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@exemplo.com"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Telefone
                          </label>
                          <input
                            type="tel"
                            className="input"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Senha Temporária *
                        </label>
                        <input
                          type="password"
                          className="input"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex">
                        <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-medium text-blue-900">Como Funciona</h4>
                          <ul className="text-sm text-blue-700 mt-1 space-y-1">
                            <li>• O consultor será automaticamente vinculado ao seu estabelecimento</li>
                            <li>• Ele será adicionado à sua equipe de gerenciamento</li>
                            <li>• Receberá email com login e senha temporária</li>
                            <li>• Poderá criar indicações apenas para este estabelecimento</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <XMarkIcon className="mx-auto h-12 w-12 text-danger-400 mb-4" />
                    <h3 className="text-lg font-medium text-secondary-900 mb-2">
                      Estabelecimento não encontrado
                    </h3>
                    <p className="text-secondary-500">
                      Você precisa estar vinculado a um estabelecimento para criar consultores.
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  {managerEstablishment && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleCreateConsultant}
                      disabled={
                        submitting ||
                        !formData.full_name ||
                        !formData.email ||
                        !formData.password ||
                        loadingEstablishment
                      }
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Criando...
                        </>
                      ) : (
                        <>
                          <UserPlusIcon className="h-4 w-4 mr-2" />
                          Adicionar à Minha Equipe
                        </>
                      )}
                    </button>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}