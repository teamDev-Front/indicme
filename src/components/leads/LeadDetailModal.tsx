'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, PencilIcon, PhoneIcon, EnvelopeIcon, MapPinIcon, CalendarIcon, UserIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface Lead {
  id: string
  full_name: string
  email: string | null
  phone: string
  cpf: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  notes: string | null
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'lost'
  indicated_by: string
  clinic_id: string
  arcadas_vendidas?: number
  converted_at?: string
  created_at: string
  updated_at: string
  users?: {
    full_name: string
    email: string
  }
}

interface LeadDetailModalProps {
  isOpen: boolean
  onClose: () => void
  leadId: string | null
  onLeadUpdate?: () => void
}

export default function LeadDetailModal({ isOpen, onClose, leadId, onLeadUpdate }: LeadDetailModalProps) {
  const { profile } = useAuth()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    notes: '',
    status: 'new' as Lead['status']
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadDetails()
    }
  }, [isOpen, leadId])

  const fetchLeadDetails = async () => {
    if (!leadId) return

    try {
      setLoading(true)
      console.log('🔍 Buscando detalhes do lead:', leadId)
      
      // Query corrigida
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          users!leads_indicated_by_fkey (
            full_name,
            email
          )
        `)
        .eq('id', leadId)
        .single()

      if (error) {
        console.error('❌ Erro na query:', error)
        throw error
      }

      console.log('✅ Lead encontrado:', data)
      setLead(data)
      setEditForm({
        notes: data.notes || '',
        status: data.status
      })
    } catch (error: any) {
      console.error('❌ Erro ao buscar detalhes do lead:', error)
      toast.error(`Erro ao carregar detalhes: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!lead) return

    try {
      setSaving(true)

      const { error } = await supabase
        .from('leads')
        .update({
          notes: editForm.notes || null,
          status: editForm.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id)

      if (error) throw error

      setLead(prev => prev ? {
        ...prev,
        notes: editForm.notes || null,
        status: editForm.status,
        updated_at: new Date().toISOString()
      } : null)

      setIsEditing(false)
      toast.success('Lead atualizado com sucesso!')
      
      if (onLeadUpdate) {
        onLeadUpdate()
      }
    } catch (error: any) {
      console.error('Erro ao atualizar lead:', error)
      toast.error('Erro ao atualizar lead')
    } finally {
      setSaving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted': return 'success'
      case 'lost': return 'danger'
      case 'scheduled': return 'primary'
      case 'contacted': return 'warning'
      default: return 'secondary'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Novo'
      case 'contacted': return 'Contatado'
      case 'scheduled': return 'Agendado'
      case 'converted': return 'Convertido'
      case 'lost': return 'Perdido'
      default: return status
    }
  }

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'male': return 'Masculino'
      case 'female': return 'Feminino'
      case 'other': return 'Outro'
      default: return 'Não informado'
    }
  }

  const canEdit = profile?.role === 'clinic_admin' || profile?.role === 'manager' || 
    (profile?.role === 'consultant' && lead?.indicated_by === profile.id)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                    Detalhes do Lead
                  </Dialog.Title>
                  <div className="flex items-center space-x-2">
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-ghost btn-sm"
                        title="Editar"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={onClose}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="loading-spinner w-8 h-8 mr-3"></div>
                    <span className="text-secondary-600">Carregando dados do lead...</span>
                  </div>
                ) : lead ? (
                  <div className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-lg font-medium text-secondary-900 mb-4">Informações Básicas</h4>
                        <div className="space-y-3">
                          <div className="flex items-center">
                            <UserIcon className="h-5 w-5 text-secondary-400 mr-3" />
                            <div>
                              <div className="font-medium text-secondary-900">{lead.full_name}</div>
                              <div className="text-sm text-secondary-500">Nome completo</div>
                            </div>
                          </div>

                          <div className="flex items-center">
                            <PhoneIcon className="h-5 w-5 text-secondary-400 mr-3" />
                            <div>
                              <div className="font-medium text-secondary-900">{lead.phone}</div>
                              <div className="text-sm text-secondary-500">Telefone</div>
                            </div>
                          </div>

                          {lead.email && (
                            <div className="flex items-center">
                              <EnvelopeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                              <div>
                                <div className="font-medium text-secondary-900">{lead.email}</div>
                                <div className="text-sm text-secondary-500">Email</div>
                              </div>
                            </div>
                          )}

                          {lead.cpf && (
                            <div className="flex items-center">
                              <DocumentTextIcon className="h-5 w-5 text-secondary-400 mr-3" />
                              <div>
                                <div className="font-medium text-secondary-900">{lead.cpf}</div>
                                <div className="text-sm text-secondary-500">CPF</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-lg font-medium text-secondary-900 mb-4">Detalhes Pessoais</h4>
                        <div className="space-y-3">
                          {lead.age && (
                            <div>
                              <div className="font-medium text-secondary-900">{lead.age} anos</div>
                              <div className="text-sm text-secondary-500">Idade</div>
                            </div>
                          )}

                          <div>
                            <div className="font-medium text-secondary-900">{getGenderLabel(lead.gender)}</div>
                            <div className="text-sm text-secondary-500">Gênero</div>
                          </div>

                          <div>
                            <span className={`badge badge-${getStatusColor(lead.status)}`}>
                              {getStatusLabel(lead.status)}
                            </span>
                            <div className="text-sm text-secondary-500 mt-1">Status atual</div>
                          </div>

                          {/* Mostrar arcadas se convertido */}
                          {lead.status === 'converted' && lead.arcadas_vendidas && (
                            <div>
                              <div className="font-medium text-primary-900">{lead.arcadas_vendidas} arcada{lead.arcadas_vendidas > 1 ? 's' : ''}</div>
                              <div className="text-sm text-secondary-500">Vendidas</div>
                            </div>
                          )}

                          <div className="flex items-center">
                            <CalendarIcon className="h-5 w-5 text-secondary-400 mr-3" />
                            <div>
                              <div className="font-medium text-secondary-900">{formatDate(lead.created_at)}</div>
                              <div className="text-sm text-secondary-500">Data de criação</div>
                            </div>
                          </div>

                          {/* Data de conversão se convertido */}
                          {lead.status === 'converted' && lead.converted_at && (
                            <div className="flex items-center">
                              <CalendarIcon className="h-5 w-5 text-success-400 mr-3" />
                              <div>
                                <div className="font-medium text-success-900">{formatDate(lead.converted_at)}</div>
                                <div className="text-sm text-success-600">Data de conversão</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    {(lead.address || lead.city || lead.state || lead.zip_code) && (
                      <div>
                        <h4 className="text-lg font-medium text-secondary-900 mb-4">Endereço</h4>
                        <div className="flex items-start">
                          <MapPinIcon className="h-5 w-5 text-secondary-400 mr-3 mt-0.5" />
                          <div className="space-y-1">
                            {lead.address && (
                              <div className="font-medium text-secondary-900">{lead.address}</div>
                            )}
                            <div className="text-sm text-secondary-600">
                              {[lead.city, lead.state].filter(Boolean).join(', ')}
                              {lead.zip_code && ` - CEP: ${lead.zip_code}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Consultor Info */}
                    {lead.users && (
                      <div>
                        <h4 className="text-lg font-medium text-secondary-900 mb-4">Indicado por</h4>
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {lead.users.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-secondary-900">{lead.users.full_name}</div>
                            <div className="text-sm text-secondary-500">{lead.users.email}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes Section */}
                    <div>
                      <h4 className="text-lg font-medium text-secondary-900 mb-4">Observações</h4>
                      {isEditing ? (
                        <div className="space-y-4">
                          {/* <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Status
                            </label>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as Lead['status'] }))}
                              className="input"
                            >
                              <option value="new">Novo</option>
                              <option value="contacted">Contatado</option>
                              <option value="scheduled">Agendado</option>
                              <option value="converted">Convertido</option>
                              <option value="lost">Perdido</option>
                            </select>
                          </div> */}
                          <div>
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Observações
                            </label>
                            <textarea
                              value={editForm.notes}
                              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                              rows={4}
                              className="input"
                              placeholder="Adicione observações sobre este lead..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-secondary-50 rounded-lg p-4">
                          {lead.notes ? (
                            <p className="text-secondary-900 whitespace-pre-wrap">{lead.notes}</p>
                          ) : (
                            <p className="text-secondary-500 italic">Nenhuma observação adicionada.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div>
                      <h4 className="text-lg font-medium text-secondary-900 mb-4">Timeline</h4>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                          <div>
                            <div className="text-sm font-medium text-secondary-900">Lead criado</div>
                            <div className="text-xs text-secondary-500">{formatDate(lead.created_at)}</div>
                          </div>
                        </div>
                        {lead.updated_at !== lead.created_at && (
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                            <div>
                              <div className="text-sm font-medium text-secondary-900">Última atualização</div>
                              <div className="text-xs text-secondary-500">{formatDate(lead.updated_at)}</div>
                            </div>
                          </div>
                        )}
                        {lead.status === 'converted' && lead.converted_at && (
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                            <div>
                              <div className="text-sm font-medium text-secondary-900">Lead convertido</div>
                              <div className="text-xs text-secondary-500">{formatDate(lead.converted_at)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-secondary-500">Lead não encontrado ou erro ao carregar.</p>
                    <button
                      onClick={fetchLeadDetails}
                      className="btn btn-primary mt-4"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                )}

                {/* Footer */}
                {isEditing && lead && (
                  <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditing(false)
                          setEditForm({
                            notes: lead.notes || '',
                            status: lead.status
                          })
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveChanges}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <div className="loading-spinner w-4 h-4 mr-2"></div>
                            Salvando...
                          </>
                        ) : (
                          'Salvar Alterações'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}