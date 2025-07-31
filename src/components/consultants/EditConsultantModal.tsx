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
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
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
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  })
  const [showInactivateConfirm, setShowInactivateConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [inactivating, setInactivating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (consultant) {
      setFormData({
        full_name: consultant.full_name,
        phone: consultant.phone || ''
      })
    }
  }, [consultant])

  const handleUpdate = async () => {
    if (!consultant) return

    try {
      setSubmitting(true)

      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', consultant.id)

      if (error) throw error

      toast.success('Consultor atualizado com sucesso!')
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
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
                      <div className="space-y-4">
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
                            disabled={submitting || !formData.full_name}
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