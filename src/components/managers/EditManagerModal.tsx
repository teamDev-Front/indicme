// src/components/managers/EditManagerModal.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  PencilIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'
import EstablishmentAutocomplete from '@/components/establishments/EstablishmentAutocomplete'

interface Manager {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  establishment_name?: string
}

interface EditManagerModalProps {
  isOpen: boolean
  onClose: () => void
  manager: Manager | null
  onSuccess: () => void
}

export default function EditManagerModal({
  isOpen,
  onClose,
  manager,
  onSuccess
}: EditManagerModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    establishment_name: ''
  })
  const [showInactivateConfirm, setShowInactivateConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inactivating, setInactivating] = useState(false)
  const [loadingEstablishment, setLoadingEstablishment] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (manager && isOpen) {
      setFormData({
        full_name: manager.full_name,
        phone: manager.phone || '',
        establishment_name: manager.establishment_name || ''
      })
      
      if (!manager.establishment_name) {
        fetchCurrentEstablishment()
      }
    }
  }, [manager, isOpen])

  const fetchCurrentEstablishment = async () => {
    if (!manager) return

    try {
      setLoadingEstablishment(true)
      
      const { data: userEst } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            name
          )
        `)
        .eq('user_id', manager.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (userEst?.establishment_codes) {
        const estData = Array.isArray(userEst.establishment_codes)
          ? userEst.establishment_codes[0]
          : userEst.establishment_codes
        
        if (estData?.name) {
          setFormData(prev => ({ ...prev, establishment_name: estData.name }))
        }
      }
    } catch (error) {
      console.error('Erro ao buscar estabelecimento atual:', error)
    } finally {
      setLoadingEstablishment(false)
    }
  }

  const handleCreateNewEstablishment = async (name: string) => {
    setFormData(prev => ({ ...prev, establishment_name: name }))
    toast.success('Novo estabelecimento criado!')
  }

  const handleUpdate = async () => {
    if (!manager) return

    try {
      setSubmitting(true)

      // Atualizar dados básicos do gerente
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', manager.id)

      if (updateError) throw updateError

      // Atualizar estabelecimento se mudou
      if (formData.establishment_name && formData.establishment_name !== manager.establishment_name) {
        // Inativar estabelecimentos atuais
        await supabase
          .from('user_establishments')
          .update({ status: 'inactive' })
          .eq('user_id', manager.id)

        // Buscar código do novo estabelecimento
        const { data: establishments } = await supabase
          .from('establishment_codes')
          .select('code')
          .eq('name', formData.establishment_name)
          .eq('is_active', true)
          .limit(1)

        if (establishments && establishments.length > 0) {
          // Vincular ao novo estabelecimento
          const { error: estError } = await supabase
            .from('user_establishments')
            .upsert({
              user_id: manager.id,
              establishment_code: establishments[0].code,
              status: 'active',
              added_by: manager.id // ou profile?.id se tiver contexto
            })

          if (estError) {
            console.warn('Erro ao vincular estabelecimento:', estError)
            toast.error('Dados atualizados, mas houve problema ao alterar o estabelecimento')
          }
        }
      }

      toast.success('Gerente atualizado com sucesso!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Erro ao atualizar gerente:', error)
      toast.error(`Erro ao atualizar gerente: ${error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInactivate = async () => {
    if (!manager) return

    try {
      setInactivating(true)

      // Verificar se o gerente tem consultores ativos
      const { data: activeConsultants, error: consultantsError } = await supabase
        .from('hierarchies')
        .select('consultant_id, users!hierarchies_consultant_id_fkey(status)')
        .eq('manager_id', manager.id)

      if (consultantsError) {
        console.error('Erro ao verificar consultores:', consultantsError)
      }

      const hasActiveConsultants = activeConsultants?.some((hierarchy: any) => {
        const consultant = Array.isArray(hierarchy.users) ? hierarchy.users[0] : hierarchy.users
        return consultant?.status === 'active'
      })

      if (hasActiveConsultants) {
        toast.error('Não é possível inativar um gerente que possui consultores ativos. Inative os consultores primeiro.')
        setInactivating(false)
        return
      }

      // Inativar o gerente
      const { error } = await supabase
        .from('users')
        .update({
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('id', manager.id)

      if (error) throw error

      toast.success('Gerente inativado com sucesso!')
      setShowInactivateConfirm(false)
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Erro ao inativar gerente:', error)
      toast.error(`Erro ao inativar gerente: ${error.message}`)
    } finally {
      setInactivating(false)
    }
  }

  if (!manager) return null

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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {!showInactivateConfirm ? (
                  // Modal de Edição
                  <>
                    <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                        Editar Gerente
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
                      {loadingEstablishment ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="loading-spinner w-6 h-6 mr-3"></div>
                          <span className="text-secondary-600">Carregando dados...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Email (apenas visualização) */}
                          <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Email (não editável)
                            </label>
                            <input
                              type="email"
                              className="input bg-secondary-50 cursor-not-allowed"
                              value={manager.email}
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
                              placeholder="Nome completo do gerente"
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

                          {/* Estabelecimento */}
                          <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Estabelecimento
                            </label>
                            <EstablishmentAutocomplete
                              value={formData.establishment_name}
                              onChange={(value) => setFormData(prev => ({ ...prev, establishment_name: value }))}
                              onCreateNew={handleCreateNewEstablishment}
                              placeholder="Digite para buscar ou criar novo estabelecimento..."
                            />
                            <p className="text-xs text-secondary-500 mt-1">
                              Estabelecimento que o gerente será responsável
                            </p>
                          </div>

                          {/* Status atual */}
                          <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-secondary-900 mb-2">Status Atual</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              manager.status === 'active' 
                                ? 'bg-success-100 text-success-800'
                                : manager.status === 'inactive'
                                ? 'bg-danger-100 text-danger-800'
                                : 'bg-warning-100 text-warning-800'
                            }`}>
                              {manager.status === 'active' ? 'Ativo' :
                               manager.status === 'inactive' ? 'Inativo' : 'Pendente'}
                            </span>
                            <p className="text-xs text-secondary-500 mt-1">
                              Cadastrado em {new Date(manager.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                      <div className="flex justify-between">
                        {/* Botão de Inativar */}
                        {manager.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setShowInactivateConfirm(true)}
                          >
                            <XCircleIcon className="h-4 w-4 mr-2" />
                            Inativar Gerente
                          </button>
                        )}

                        {manager.status !== 'active' && (
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
                            disabled={submitting || !formData.full_name || loadingEstablishment}
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
                          Tem certeza que deseja inativar o gerente <strong>{manager.full_name}</strong>?
                        </p>

                        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-warning-800 mb-2">O que acontecerá:</h4>
                          <ul className="text-sm text-warning-700 space-y-1">
                            <li>• O gerente não conseguirá mais fazer login no sistema</li>
                            <li>• Todos os dados e histórico serão mantidos</li>
                            <li>• As comissões já geradas não serão afetadas</li>
                            <li>• A equipe de consultores ficará sem gerente</li>
                            <li>• A ação pode ser revertida reativando o gerente</li>
                          </ul>
                        </div>

                        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-danger-800 mb-2">⚠️ Importante:</h4>
                          <p className="text-sm text-danger-700">
                            Certifique-se de que não há consultores ativos sob este gerente. 
                            Se houver, você precisará inativá-los primeiro ou transferi-los para outro gerente.
                          </p>
                        </div>

                        <div className="bg-info-50 border border-info-200 rounded-lg p-4">
                          <p className="text-sm text-info-700">
                            <strong>Nota:</strong> Esta é uma ação reversível. O gerente pode ser reativado 
                            a qualquer momento alterando seu status para "Ativo".
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