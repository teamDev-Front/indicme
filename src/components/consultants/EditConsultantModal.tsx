// src/components/consultants/EditConsultantModal.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

interface Consultant {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
}

interface Manager {
  id: string
  full_name: string
  email: string
  establishment_name?: string
}

interface EditConsultantModalProps {
  isOpen: boolean
  onClose: () => void
  consultant: Consultant | null
  onSuccess: () => void
}

export default function EditConsultantModal({
  isOpen,
  onClose,
  consultant,
  onSuccess
}: EditConsultantModalProps) {
  const { profile } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    manager_id: '' // 🔥 NOVO
  })
  const [managers, setManagers] = useState<Manager[]>([])
  const [currentManager, setCurrentManager] = useState<Manager | null>(null)
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [searchManager, setSearchManager] = useState('')
  const [showInactivateConfirm, setShowInactivateConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inactivating, setInactivating] = useState(false)
  const supabase = createClient()

  // Determinar se pode gerenciar hierarquia
  const canManageHierarchy = profile?.role === 'clinic_admin'

  useEffect(() => {
    if (consultant && isOpen) {
      setFormData({
        full_name: consultant.full_name,
        phone: consultant.phone || '',
        manager_id: '' // Será preenchido após buscar o gerente atual
      })
      
      if (canManageHierarchy) {
        fetchCurrentManager()
        fetchAvailableManagers()
      }
    }
  }, [consultant, isOpen, canManageHierarchy])

  const fetchCurrentManager = async () => {
    if (!consultant) return

    try {
      console.log('🔍 Buscando gerente atual do consultor:', consultant.id)
      
      const { data: hierarchyData, error } = await supabase
        .from('hierarchies')
        .select(`
          manager_id,
          users!hierarchies_manager_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('consultant_id', consultant.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar gerente atual:', error)
        return
      }

      if (hierarchyData?.users) {
        const manager = Array.isArray(hierarchyData.users) 
          ? hierarchyData.users[0] 
          : hierarchyData.users

        // Buscar estabelecimento do gerente
        const { data: managerEst } = await supabase
          .from('user_establishments')
          .select(`
            establishment_codes!user_establishments_establishment_code_fkey (
              name
            )
          `)
          .eq('user_id', manager.id)
          .eq('status', 'active')
          .single()

        let establishmentName = 'Estabelecimento não identificado'
        if (managerEst?.establishment_codes) {
          const estData = Array.isArray(managerEst.establishment_codes)
            ? managerEst.establishment_codes[0]
            : managerEst.establishment_codes
          establishmentName = estData?.name || 'Estabelecimento não identificado'
        }

        const currentMgr = {
          id: manager.id,
          full_name: manager.full_name,
          email: manager.email,
          establishment_name: establishmentName
        }

        setCurrentManager(currentMgr)
        setFormData(prev => ({ ...prev, manager_id: manager.id }))
        console.log('✅ Gerente atual encontrado:', currentMgr.full_name)
      } else {
        console.log('ℹ️ Consultor não possui gerente')
        setCurrentManager(null)
        setFormData(prev => ({ ...prev, manager_id: '' }))
      }
    } catch (error) {
      console.error('Erro ao buscar gerente atual:', error)
    }
  }

  const fetchAvailableManagers = async () => {
    try {
      setLoadingManagers(true)
      console.log('🔍 Buscando gerentes disponíveis...')

      // Buscar clínica do usuário atual
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) {
        console.error('Clínica não encontrada')
        return
      }

      // Buscar gerentes da mesma clínica
      const { data: managersData, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          user_clinics!inner(clinic_id)
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('role', 'manager')
        .eq('status', 'active')
        .order('full_name')

      if (error) {
        console.error('Erro ao buscar gerentes:', error)
        toast.error('Erro ao carregar gerentes disponíveis')
        return
      }

      // Para cada gerente, buscar o estabelecimento
      const managersWithEstablishments = await Promise.all(
        (managersData || []).map(async (manager) => {
          try {
            const { data: managerEst } = await supabase
              .from('user_establishments')
              .select(`
                establishment_codes!user_establishments_establishment_code_fkey (
                  name
                )
              `)
              .eq('user_id', manager.id)
              .eq('status', 'active')
              .single()

            let establishmentName = 'Sem estabelecimento'
            if (managerEst?.establishment_codes) {
              const estData = Array.isArray(managerEst.establishment_codes)
                ? managerEst.establishment_codes[0]
                : managerEst.establishment_codes
              establishmentName = estData?.name || 'Sem estabelecimento'
            }

            return {
              id: manager.id,
              full_name: manager.full_name,
              email: manager.email,
              establishment_name: establishmentName
            }
          } catch (error) {
            console.warn('Erro ao buscar estabelecimento do gerente:', manager.id, error)
            return {
              id: manager.id,
              full_name: manager.full_name,
              email: manager.email,
              establishment_name: 'Erro ao carregar'
            }
          }
        })
      )

      setManagers(managersWithEstablishments)
      console.log('✅ Gerentes carregados:', managersWithEstablishments.length)
    } catch (error) {
      console.error('Erro ao buscar gerentes:', error)
      toast.error('Erro ao carregar gerentes')
    } finally {
      setLoadingManagers(false)
    }
  }

  const handleUpdate = async () => {
    if (!consultant) return

    try {
      setSubmitting(true)

      // 1. Atualizar dados básicos do consultor
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id)

      if (updateError) throw updateError

      // 2. 🔥 NOVO: Gerenciar hierarquia se necessário e permitido
      if (canManageHierarchy) {
        const currentManagerId = currentManager?.id || null
        const newManagerId = formData.manager_id || null

        if (currentManagerId !== newManagerId) {
          // Buscar clínica do consultor
          const { data: consultantClinic } = await supabase
            .from('user_clinics')
            .select('clinic_id')
            .eq('user_id', consultant.id)
            .single()

          if (!consultantClinic) {
            throw new Error('Clínica do consultor não encontrada')
          }

          if (currentManagerId && newManagerId !== currentManagerId) {
            // Remover hierarquia atual
            console.log('🔄 Removendo hierarquia atual...')
            const { error: deleteHierarchyError } = await supabase
              .from('hierarchies')
              .delete()
              .eq('consultant_id', consultant.id)
              .eq('manager_id', currentManagerId)

            if (deleteHierarchyError) {
              console.warn('Erro ao remover hierarquia atual:', deleteHierarchyError)
            }
          }

          if (newManagerId) {
            // Criar nova hierarquia
            console.log('➕ Criando nova hierarquia...')
            const { error: insertHierarchyError } = await supabase
              .from('hierarchies')
              .insert({
                manager_id: newManagerId,
                consultant_id: consultant.id,
                clinic_id: consultantClinic.clinic_id
              })

            if (insertHierarchyError && insertHierarchyError.code !== '23505') {
              // 23505 = unique constraint violation (já existe)
              throw insertHierarchyError
            }

            console.log('✅ Nova hierarquia criada')
          } else {
            console.log('ℹ️ Consultor ficará sem gerente')
          }

          toast.success('Consultor atualizado e hierarquia ajustada!')
        } else {
          toast.success('Consultor atualizado com sucesso!')
        }
      } else {
        toast.success('Consultor atualizado com sucesso!')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Erro ao atualizar consultor:', error)
      toast.error(`Erro ao atualizar consultor: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInactivate = async () => {
    if (!consultant) return

    try {
      setInactivating(true)

      // Inativar o consultor (não deletar, apenas marcar como inativo)
      const { error } = await supabase
        .from('users')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id)

      if (error) throw error

      toast.success('Consultor inativado com sucesso!')
      setShowInactivateConfirm(false)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Erro ao inativar consultor:', error)
      toast.error(`Erro ao inativar consultor: ${error.message}`)
    } finally {
      setInactivating(false)
    }
  }

  // Filtrar gerentes pela busca
  const filteredManagers = managers.filter(manager =>
    manager.full_name.toLowerCase().includes(searchManager.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchManager.toLowerCase()) ||
    (manager.establishment_name && manager.establishment_name.toLowerCase().includes(searchManager.toLowerCase()))
  )

  if (!consultant) return null

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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {!showInactivateConfirm ? (
                  // Modal de Edição
                  <>
                    <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                        Editar Consultor
                      </Dialog.Title>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="space-y-6">
                        {/* Email (apenas visualização) */}
                        <div>
                          <label className="block text-sm font-medium text-secondary-700 mb-2">
                            Email (não editável)
                          </label>
                          <input
                            type="email"
                            className="input bg-secondary-50 cursor-not-allowed"
                            value={consultant.email}
                            disabled
                          />
                          <p className="text-xs text-secondary-500 mt-1">
                            O email não pode ser alterado por questões de segurança
                          </p>
                        </div>

                        {/* Nome */}
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

                        {/* Telefone */}
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

                        {/* 🔥 NOVO: Seção de Gerente (apenas para clinic_admin) */}
                        {canManageHierarchy && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-blue-900 mb-4 flex items-center">
                              <UserGroupIcon className="h-5 w-5 mr-2" />
                              Gerente Responsável
                            </h4>

                            {/* Gerente Atual */}
                            {currentManager && (
                              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <h5 className="text-sm font-medium text-green-900 mb-2">Gerente Atual</h5>
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                                    {currentManager.full_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-green-900">{currentManager.full_name}</div>
                                    <div className="text-xs text-green-700">{currentManager.email}</div>
                                    <div className="text-xs text-green-600">{currentManager.establishment_name}</div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {!currentManager && (
                              <div className="mb-4 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                                <p className="text-sm text-warning-700">
                                  ⚠️ Este consultor não possui um gerente atribuído
                                </p>
                              </div>
                            )}

                            {/* Seleção de Novo Gerente */}
                            <div>
                              <label className="block text-sm font-medium text-blue-800 mb-2">
                                {currentManager ? 'Alterar para outro gerente (opcional)' : 'Selecionar gerente *'}
                              </label>

                              {loadingManagers ? (
                                <div className="flex items-center py-4">
                                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                                  <span className="text-sm text-secondary-600">Carregando gerentes...</span>
                                </div>
                              ) : (
                                <>
                                  {/* Search */}
                                  <div className="relative mb-4">
                                    <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                                    <input
                                      type="text"
                                      placeholder="Buscar gerente por nome, email ou estabelecimento..."
                                      className="input pl-10 text-sm"
                                      value={searchManager}
                                      onChange={(e) => setSearchManager(e.target.value)}
                                    />
                                  </div>

                                  {/* Lista de Gerentes */}
                                  <div className="max-h-48 overflow-y-auto border border-secondary-200 rounded-lg">
                                    {/* Opção "Nenhum gerente" */}
                                    <div
                                      onClick={() => setFormData(prev => ({ ...prev, manager_id: '' }))}
                                      className={`p-3 cursor-pointer hover:bg-secondary-50 border-b border-secondary-100 ${
                                        formData.manager_id === '' ? 'bg-blue-100 border-blue-200' : ''
                                      }`}
                                    >
                                      <div className="flex justify-between items-center">
                                        <div className="flex items-center">
                                          <div className="w-8 h-8 bg-secondary-400 rounded-full flex items-center justify-center text-white text-sm mr-3">
                                            <XCircleIcon className="h-4 w-4" />
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-secondary-700">Nenhum gerente</div>
                                            <div className="text-xs text-secondary-500">Consultor ficará sem gerente</div>
                                          </div>
                                        </div>
                                        {formData.manager_id === '' && (
                                          <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Lista de gerentes disponíveis */}
                                    {filteredManagers.map((manager) => (
                                      <div
                                        key={manager.id}
                                        onClick={() => setFormData(prev => ({ ...prev, manager_id: manager.id }))}
                                        className={`p-3 cursor-pointer hover:bg-secondary-50 border-b border-secondary-100 last:border-b-0 ${
                                          formData.manager_id === manager.id ? 'bg-blue-100 border-blue-200' : ''
                                        }`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="flex items-center">
                                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                                              {manager.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                              <div className="text-sm font-medium text-secondary-900">{manager.full_name}</div>
                                              <div className="text-xs text-secondary-500">{manager.email}</div>
                                              <div className="text-xs text-blue-600">{manager.establishment_name}</div>
                                            </div>
                                          </div>
                                          {formData.manager_id === manager.id && (
                                            <CheckCircleIcon className="h-5 w-5 text-blue-600" />
                                          )}
                                        </div>
                                      </div>
                                    ))}

                                    {filteredManagers.length === 0 && managers.length > 0 && (
                                      <div className="p-4 text-center text-secondary-500">
                                        Nenhum gerente encontrado com esse termo
                                      </div>
                                    )}

                                    {managers.length === 0 && (
                                      <div className="p-4 text-center text-secondary-500">
                                        Nenhum gerente disponível
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              <p className="text-xs text-blue-600 mt-2">
                                💡 {currentManager ? 'Deixe vazio para manter o gerente atual' : 'Selecione um gerente para este consultor'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Status atual */}
                        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-secondary-900 mb-2">Status Atual</h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            consultant.status === 'active' 
                              ? 'bg-success-100 text-success-800'
                              : consultant.status === 'inactive'
                              ? 'bg-danger-100 text-danger-800'
                              : 'bg-warning-100 text-warning-800'
                          }`}>
                            {consultant.status === 'active' ? 'Ativo' :
                             consultant.status === 'inactive' ? 'Inativo' : 'Pendente'}
                          </span>
                          <p className="text-xs text-secondary-500 mt-1">
                            Cadastrado em {new Date(consultant.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                      <div className="flex justify-between">
                        {/* Botão de Inativar */}
                        {consultant.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setShowInactivateConfirm(true)}
                          >
                            <XCircleIcon className="h-4 w-4 mr-2" />
                            Inativar Consultor
                          </button>
                        )}

                        {consultant.status !== 'active' && (
                          <div></div> // Placeholder para manter o espaçamento
                        )}

                        {/* Botões de ação */}
                        <div className="flex space-x-3">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleUpdate}
                            disabled={submitting || !formData.full_name || loadingManagers}
                          >
                            {submitting ? (
                              <>
                                <div className="loading-spinner w-4 h-4 mr-2"></div>
                                Salvando...
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                Salvar Alterações
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Modal de Confirmação de Inativação
                  <>
                    <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                      <div className="flex items-center">
                        <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 mr-3" />
                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                          Confirmar Inativação
                        </Dialog.Title>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowInactivateConfirm(false)}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="space-y-4">
                        <p className="text-sm text-secondary-700">
                          Tem certeza que deseja inativar o consultor <strong>{consultant.full_name}</strong>?
                        </p>

                        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-warning-800 mb-2">O que acontecerá:</h4>
                          <ul className="text-sm text-warning-700 space-y-1">
                            <li>• O consultor não conseguirá mais fazer login no sistema</li>
                            <li>• Todos os dados e histórico serão mantidos</li>
                            <li>• As comissões já geradas não serão afetadas</li>
                            <li>• A ação pode ser revertida reativando o consultor</li>
                          </ul>
                        </div>

                        <div className="bg-info-50 border border-info-200 rounded-lg p-4">
                          <p className="text-sm text-info-700">
                            <strong>Nota:</strong> Esta é uma ação reversível. O consultor pode ser reativado 
                            a qualquer momento alterando seu status para &quot;Ativo&quot;.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setShowInactivateConfirm(false)}
                          disabled={inactivating}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={handleInactivate}
                          disabled={inactivating}
                        >
                          {inactivating ? (
                            <>
                              <div className="loading-spinner w-4 h-4 mr-2"></div>
                              Inativando...
                            </>
                          ) : (
                            <>
                              <XCircleIcon className="h-4 w-4 mr-2" />
                              Confirmar Inativação
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}