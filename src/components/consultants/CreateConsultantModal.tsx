// src/components/consultants/CreateConsultantModal.tsx - VERSÃO CORRIGIDA PARA SUPER ADMIN
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
import EstablishmentAutocomplete from '@/components/establishments/EstablishmentAutocomplete'

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
    password: '',
    establishment_name: '' // 🔥 NOVO: Para clinic_admin selecionar estabelecimento
  })
  const [managerEstablishment, setManagerEstablishment] = useState<ManagerEstablishment | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingEstablishment, setLoadingEstablishment] = useState(false)
  const supabase = createClient()

  // 🔥 NOVO: Determinar se é manager ou clinic_admin
  const isManager = profile?.role === 'manager'
  const isClinicAdmin = profile?.role === 'clinic_admin'

  useEffect(() => {
    if (isOpen) {
      if (isManager) {
        fetchManagerEstablishment()
      }
      // clinic_admin não precisa buscar estabelecimento fixo
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
        .single()

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

  // 🔥 NOVO: Função para criar estabelecimento (para clinic_admin)
  const handleCreateNewEstablishment = async (name: string) => {
    setFormData(prev => ({ ...prev, establishment_name: name }))
    toast.success('Novo estabelecimento será criado!')
  }

  const handleCreateConsultant = async () => {
    if (!profile) {
      toast.error('Usuário não autenticado')
      return
    }

    // Validação específica por role
    if (isManager && !managerEstablishment) {
      toast.error('Estabelecimento não identificado')
      return
    }

    if (isClinicAdmin && !formData.establishment_name) {
      toast.error('Selecione um estabelecimento')
      return
    }

    try {
      setSubmitting(true)

      // 1. Buscar clínica do usuário atual
      const { data: userClinic, error: clinicError } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile.id)
        .single()

      if (clinicError || !userClinic) {
        throw new Error('Clínica não encontrada. Verifique se você está associado a uma clínica.')
      }

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

      // 3. Aguardar propagação
      await new Promise(resolve => setTimeout(resolve, 2000))

      // 4. Criar perfil
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: newUserId,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: 'consultant',
          status: 'active',
        })

      if (profileError) {
        if (profileError.code === '23505') {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              email: formData.email,
              full_name: formData.full_name,
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

      // 5. Associar à clínica
      const { error: clinicAssocError } = await supabase
        .from('user_clinics')
        .insert({
          user_id: newUserId,
          clinic_id: userClinic.clinic_id,
        })

      if (clinicAssocError && clinicAssocError.code !== '23505') {
        throw clinicAssocError
      }

      // 6. 🔥 NOVO: Lógica diferente para manager vs clinic_admin
      if (isManager && managerEstablishment) {
        // MANAGER: Usar estabelecimento fixo e criar hierarquia

        // Vincular ao estabelecimento do gerente
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
        }

        // Criar hierarquia
        const { error: hierarchyError } = await supabase
          .from('hierarchies')
          .insert({
            manager_id: profile.id,
            consultant_id: newUserId,
            clinic_id: userClinic.clinic_id,
          })

        if (hierarchyError && hierarchyError.code !== '23505') {
          console.warn('Erro ao criar hierarquia:', hierarchyError)
        }

        toast.success(`Consultor criado e vinculado ao estabelecimento ${managerEstablishment.name}!`)

      } else if (isClinicAdmin && formData.establishment_name) {
        // CLINIC_ADMIN: Buscar/criar estabelecimento e vincular consultor

        // Buscar estabelecimento existente
        let establishmentCode = ''
        const { data: existingEstablishment } = await supabase
          .from('establishment_codes')
          .select('code')
          .eq('name', formData.establishment_name)
          .eq('is_active', true)
          .single()

        if (existingEstablishment) {
          establishmentCode = existingEstablishment.code
        } else {
          // Criar novo estabelecimento
          const { data: newEstablishment, error: estError } = await supabase
            .from('establishment_codes')
            .insert({
              code: formData.establishment_name.toUpperCase().replace(/\s+/g, '_'),
              name: formData.establishment_name,
              is_active: true
            })
            .select('code')
            .single()

          if (estError) {
            console.warn('Erro ao criar estabelecimento:', estError)
          } else if (newEstablishment) {
            establishmentCode = newEstablishment.code
          }
        }

        // Vincular consultor ao estabelecimento
        if (establishmentCode) {
          const { error: establishmentError } = await supabase
            .from('user_establishments')
            .insert({
              user_id: newUserId,
              establishment_code: establishmentCode,
              status: 'active',
              added_by: profile.id
            })

          if (establishmentError) {
            console.warn('Erro ao vincular ao estabelecimento:', establishmentError)
          }
        }

        toast.success(`Consultor criado e vinculado ao estabelecimento ${formData.establishment_name}!`)
      }

      // Resetar form
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        establishment_name: ''
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
                  {isManager ? 'Adicionar Consultor à Minha Equipe' : 'Novo Consultor'}
                </Dialog.Title>

                {(isManager && loadingEstablishment) ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="loading-spinner w-6 h-6 mr-3"></div>
                    <span className="text-secondary-600">Carregando estabelecimento...</span>
                  </div>
                ) : (isManager && managerEstablishment) || isClinicAdmin ? (
                  <div className="space-y-6">
                    {/* Estabelecimento (diferente para manager vs clinic_admin) */}
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <BuildingOfficeIcon className="h-5 w-5 text-primary-500 mr-3 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-primary-900">Estabelecimento</h4>
                          {isManager && managerEstablishment ? (
                            <>
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
                              <p className="text-xs text-primary-600 mt-2">
                                O consultor será automaticamente vinculado ao seu estabelecimento
                              </p>
                            </>
                          ) : isClinicAdmin ? (
                            <div className="mt-2">
                              <EstablishmentAutocomplete
                                value={formData.establishment_name}
                                onChange={(value) => setFormData(prev => ({ ...prev, establishment_name: value }))}
                                onCreateNew={handleCreateNewEstablishment}
                                placeholder="Digite para buscar ou criar novo estabelecimento..."
                              />
                              <p className="text-xs text-primary-600 mt-1">
                                Selecione um estabelecimento existente ou crie um novo
                              </p>
                            </div>
                          ) : null}
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
                            {isManager ? (
                              <>
                                <li>• O consultor será automaticamente vinculado ao seu estabelecimento</li>
                                <li>• Ele será adicionado à sua equipe de gerenciamento</li>
                              </>
                            ) : (
                              <>
                                <li>• O consultor será vinculado ao estabelecimento selecionado</li>
                                <li>• Poderá criar indicações para este estabelecimento</li>
                              </>
                            )}
                            <li>• Receberá email com login e senha temporária</li>
                            <li>• Poderá alterar a senha no primeiro acesso</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <XMarkIcon className="mx-auto h-12 w-12 text-danger-400 mb-4" />
                    <h3 className="text-lg font-medium text-secondary-900 mb-2">
                      {isManager ? 'Estabelecimento não encontrado' : 'Erro de configuração'}
                    </h3>
                    <p className="text-secondary-500">
                      {isManager
                        ? 'Você precisa estar vinculado a um estabelecimento para criar consultores.'
                        : 'Houve um problema na configuração. Tente novamente.'
                      }
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
                  {((isManager && managerEstablishment) || (isClinicAdmin && formData.establishment_name)) && (
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
                          {isManager ? 'Adicionar à Minha Equipe' : 'Criar Consultor'}
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