// src/components/leads/LeadDetailModal.tsx - ADICIONAR FUNCIONALIDADE DE DELETE
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  ExclamationTriangleIcon,
  TrashIcon, // NOVO
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import React from 'react'

interface LeadDetailModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string | null
  onLeadDeleted?: () => void // NOVO: Callback após deletar
}

interface LeadDetail {
  id: string
  full_name: string
  email: string | null
  phone: string
  status: string
  arcadas_vendidas: number
  notes: string | null
  establishment_code: string
  created_at: string
  converted_at: string | null
  updated_at: string
  users?: {
    full_name: string
    email: string
    role: string
  }
  establishment_codes?: {
    name: string
  }
}

interface Commission {
  id: string
  amount: number
  type: 'consultant' | 'manager'
  status: string
  created_at: string
  users: {
    full_name: string
    role: string
  }
}

export default function LeadDetailModal({ 
  isOpen, 
  onClose, 
  leadId,
  onLeadDeleted 
}: LeadDetailModalProps) {
  const { profile } = useAuth()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false) // NOVO
  const [deleting, setDeleting] = useState(false) // NOVO
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetail()
    }
  }, [isOpen, leadId])

  const fetchLeadDetail = async () => {
    if (!leadId) return

    try {
      setLoading(true)

      // Buscar lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select(`
          *,
          users!leads_indicated_by_fkey (
            full_name,
            email,
            role
          ),
          establishment_codes (
            name
          )
        `)
        .eq('id', leadId)
        .single()

      if (leadError) throw leadError

      setLead(leadData)

      // Buscar comissões relacionadas
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select(`
          *,
          users (
            full_name,
            role
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (commissionsError) throw commissionsError

      setCommissions(commissionsData || [])

    } catch (error) {
      console.error('Erro ao buscar detalhes:', error)
      toast.error('Erro ao carregar detalhes do lead')
    } finally {
      setLoading(false)
    }
  }

  // 🔥 NOVA FUNÇÃO: Deletar Lead
  const handleDeleteLead = async () => {
    if (!leadId || !lead) return

    try {
      setDeleting(true)
      console.log('🗑️ Iniciando exclusão do lead:', lead.full_name)

      // Verificar se há comissões pagas
      const paidCommissions = commissions.filter(c => c.status === 'paid')
      
      if (paidCommissions.length > 0) {
        toast.error('Não é possível excluir lead com comissões já pagas!')
        setIsDeleteModalOpen(false)
        return
      }

      // 1. Deletar comissões relacionadas
      console.log('🧹 Removendo comissões...')
      const { error: commissionsError } = await supabase
        .from('commissions')
        .delete()
        .eq('lead_id', leadId)

      if (commissionsError) {
        console.error('Erro ao deletar comissões:', commissionsError)
        throw commissionsError
      }

      // 2. Verificar se é lead de indicação
      const { data: indications } = await supabase
        .from('lead_indications')
        .select('id')
        .or(`original_lead_id.eq.${leadId},new_lead_id.eq.${leadId}`)

      if (indications && indications.length > 0) {
        console.log('🧹 Removendo indicações...')
        const { error: indicationsError } = await supabase
          .from('lead_indications')
          .delete()
          .or(`original_lead_id.eq.${leadId},new_lead_id.eq.${leadId}`)

        if (indicationsError) {
          console.warn('Aviso ao remover indicações:', indicationsError)
        }
      }

      // 3. Deletar o lead
      console.log('🧹 Removendo lead...')
      const { error: leadError } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)

      if (leadError) {
        console.error('Erro ao deletar lead:', leadError)
        throw leadError
      }

      console.log('✅ Lead excluído com sucesso!')
      toast.success(`Lead "${lead.full_name}" excluído com sucesso!`)

      // Chamar callback e fechar modal
      if (onLeadDeleted) {
        onLeadDeleted()
      }
      
      setIsDeleteModalOpen(false)
      onClose()

    } catch (error: any) {
      console.error('❌ Erro ao excluir lead:', error)
      toast.error(`Erro ao excluir lead: ${error.message}`)
    } finally {
      setDeleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800'
      case 'contacted': return 'bg-yellow-100 text-yellow-800'
      case 'scheduled': return 'bg-purple-100 text-purple-800'
      case 'converted': return 'bg-green-100 text-green-800'
      case 'lost': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Novo'
      case 'contacted': return 'Contatado'
      case 'scheduled': return 'Agendado'
      case 'converted': return 'Convertido'
      case 'lost': return 'Perdido'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted': return CheckCircleIcon
      case 'lost': return XCircleIcon
      default: return ClockIcon
    }
  }

  if (!lead && !loading) return null

  return (
    <>
      {/* Modal Principal */}
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
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <Dialog.Title className="text-xl font-bold text-white">
                            Detalhes do Lead
                          </Dialog.Title>
                          {lead && (
                            <p className="text-primary-100 text-sm">{lead.full_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="loading-spinner w-8 h-8"></div>
                      </div>
                    ) : lead ? (
                      <div className="space-y-6">
                        {/* Status Badge */}
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(lead.status)}`}>
                            {React.createElement(getStatusIcon(lead.status), { className: 'h-4 w-4 mr-1' })}
                            {getStatusText(lead.status)}
                          </span>

                          {/* 🔥 NOVO: Botão de Delete (apenas para super admin) */}
                          {profile?.role === 'clinic_admin' && (
                            <button
                              onClick={() => setIsDeleteModalOpen(true)}
                              className="btn btn-danger btn-sm"
                            >
                              <TrashIcon className="h-4 w-4 mr-1" />
                              Excluir Lead
                            </button>
                          )}
                        </div>

                        {/* Informações Básicas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                                Nome Completo
                              </label>
                              <p className="text-sm text-secondary-900 mt-1 font-medium">
                                {lead.full_name}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide flex items-center">
                                <PhoneIcon className="h-3 w-3 mr-1" />
                                Telefone
                              </label>
                              <p className="text-sm text-secondary-900 mt-1">
                                {lead.phone}
                              </p>
                            </div>

                            {lead.email && (
                              <div>
                                <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide flex items-center">
                                  <EnvelopeIcon className="h-3 w-3 mr-1" />
                                  Email
                                </label>
                                <p className="text-sm text-secondary-900 mt-1">
                                  {lead.email}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide flex items-center">
                                <BuildingOfficeIcon className="h-3 w-3 mr-1" />
                                Estabelecimento
                              </label>
                              <p className="text-sm text-secondary-900 mt-1 font-medium">
                                {lead.establishment_codes?.name || 'Não definido'}
                              </p>
                              <p className="text-xs text-secondary-500">
                                {lead.establishment_code}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                                Indicado Por
                              </label>
                              <p className="text-sm text-secondary-900 mt-1 font-medium">
                                {lead.users?.full_name}
                              </p>
                              <p className="text-xs text-secondary-500">
                                {lead.users?.email}
                              </p>
                            </div>

                            {lead.status === 'converted' && (
                              <div>
                                <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                                  Arcadas Vendidas
                                </label>
                                <p className="text-sm text-secondary-900 mt-1 font-bold">
                                  {lead.arcadas_vendidas} {lead.arcadas_vendidas === 1 ? 'Arcada' : 'Arcadas'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Observações */}
                        {lead.notes && (
                          <div className="bg-secondary-50 rounded-lg p-4">
                            <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide block mb-2">
                              Observações
                            </label>
                            <p className="text-sm text-secondary-700 whitespace-pre-wrap">
                              {lead.notes}
                            </p>
                          </div>
                        )}

                        {/* Datas */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                          <div>
                            <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide flex items-center">
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              Criado em
                            </label>
                            <p className="text-sm text-secondary-900 mt-1">
                              {format(new Date(lead.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>

                          {lead.converted_at && (
                            <div>
                              <label className="text-xs font-medium text-success-600 uppercase tracking-wide flex items-center">
                                <CheckCircleIcon className="h-3 w-3 mr-1" />
                                Convertido em
                              </label>
                              <p className="text-sm text-success-900 mt-1 font-medium">
                                {format(new Date(lead.converted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          )}

                          <div>
                            <label className="text-xs font-medium text-secondary-500 uppercase tracking-wide">
                              Última Atualização
                            </label>
                            <p className="text-sm text-secondary-900 mt-1">
                              {format(new Date(lead.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        {/* Comissões */}
                        {commissions.length > 0 && (
                          <div className="pt-6 border-t">
                            <h3 className="text-sm font-semibold text-secondary-900 mb-4 flex items-center">
                              <CurrencyDollarIcon className="h-5 w-5 mr-2 text-primary-600" />
                              Comissões Geradas
                            </h3>
                            <div className="space-y-3">
                              {commissions.map((commission) => (
                                <div
                                  key={commission.id}
                                  className="bg-secondary-50 rounded-lg p-4 flex items-center justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-secondary-900">
                                      {commission.users.full_name}
                                    </p>
                                    <p className="text-xs text-secondary-500">
                                      {commission.type === 'consultant' ? 'Consultor' : 'Gerente'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-primary-600">
                                      R$ {commission.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      commission.status === 'paid' 
                                        ? 'bg-success-100 text-success-700'
                                        : commission.status === 'pending'
                                        ? 'bg-warning-100 text-warning-700'
                                        : 'bg-danger-100 text-danger-700'
                                    }`}>
                                      {commission.status === 'paid' ? 'Pago' : commission.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Footer */}
                  <div className="bg-secondary-50 px-6 py-4 flex justify-end">
                    <button
                      onClick={onClose}
                      className="btn btn-secondary"
                    >
                      Fechar
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* 🔥 NOVO: Modal de Confirmação de Exclusão */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setIsDeleteModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  <div className="p-6">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-danger-100 rounded-full mb-4">
                      <ExclamationTriangleIcon className="h-6 w-6 text-danger-600" />
                    </div>

                    <Dialog.Title className="text-lg font-semibold text-center text-secondary-900 mb-2">
                      Confirmar Exclusão
                    </Dialog.Title>

                    <p className="text-sm text-secondary-600 text-center mb-6">
                      Tem certeza que deseja excluir o lead <strong>"{lead?.full_name}"</strong>?
                      <br /><br />
                      Esta ação é <strong className="text-danger-600">irreversível</strong> e irá:
                    </p>

                    <ul className="text-sm text-secondary-600 space-y-2 mb-6 bg-danger-50 rounded-lg p-4">
                      <li className="flex items-start">
                        <span className="text-danger-500 mr-2">•</span>
                        Deletar todas as comissões pendentes relacionadas
                      </li>
                      <li className="flex items-start">
                        <span className="text-danger-500 mr-2">•</span>
                        Remover todas as indicações vinculadas
                      </li>
                      <li className="flex items-start">
                        <span className="text-danger-500 mr-2">•</span>
                        Excluir permanentemente o registro do lead
                      </li>
                    </ul>

                    {commissions.some(c => c.status === 'paid') && (
                      <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-warning-800 font-medium">
                          ⚠️ Este lead possui comissões pagas e não pode ser excluído.
                        </p>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      <button
                        onClick={() => setIsDeleteModalOpen(false)}
                        disabled={deleting}
                        className="btn btn-secondary flex-1"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDeleteLead}
                        disabled={deleting || commissions.some(c => c.status === 'paid')}
                        className="btn btn-danger flex-1"
                      >
                        {deleting ? (
                          <>
                            <div className="loading-spinner w-4 h-4 mr-2"></div>
                            Excluindo...
                          </>
                        ) : (
                          <>
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Excluir Lead
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}