'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import ArcadasModal from '@/components/leads/ArcadasModal'


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
  created_at: string
  updated_at: string
  arcadas_vendidas?: number
  converted_at?: string
  consultant_id?: string
  manager_id?: string
  users?: {
    full_name: string
    email: string
  }
}

const statusOptions = [
  { value: 'new', label: 'Novo', color: 'primary' },
  { value: 'contacted', label: 'Contatado', color: 'warning' },
  { value: 'scheduled', label: 'Agendado', color: 'primary' },
  { value: 'converted', label: 'Convertido', color: 'success' },
  { value: 'lost', label: 'Perdido', color: 'danger' },
]

export default function LeadsPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [consultantFilter, setConsultantFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [consultants, setConsultants] = useState<Array<{ id: string, full_name: string }>>([])
  const [states, setStates] = useState<string[]>([])
  const [showArcadasModal, setShowArcadasModal] = useState(false)
  const [selectedLeadForConversion, setSelectedLeadForConversion] = useState<Lead | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchLeads()
    }
  }, [profile])

  const fetchLeads = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('leads')
        .select(`
          *,
          users:indicated_by (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })

      // Filtrar baseado no role do usuário
      if (profile?.role === 'consultant') {
        query = query.eq('indicated_by', profile.id)
      } else if (profile?.role === 'manager') {
        // Manager vê leads de sua equipe + próprios
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id)

        query = query.in('indicated_by', consultantIds)
      }
      // Clinic admin/viewer veem todos (sem filtros adicionais)

      const { data, error } = await query

      if (error) {
        throw error
      }

      const leadsData = data || []
      setLeads(leadsData)

      // Extrair consultores únicos para o filtro
      const uniqueConsultants = Array.from(
        new Map(
          leadsData
            .filter(lead => lead.users)
            .map(lead => [lead.users!.full_name, { id: lead.indicated_by, full_name: lead.users!.full_name }])
        ).values()
      )
      setConsultants(uniqueConsultants)

      // Extrair estados únicos para o filtro
      const uniqueStates = Array.from(
        new Set(leadsData.filter(lead => lead.state).map(lead => lead.state!))
      ).sort()
      setStates(uniqueStates)

    } catch (error: any) {
      console.error('Erro ao buscar leads:', error)
      toast.error('Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      // Se está marcando como convertido, abrir modal de arcadas
      if (newStatus === 'converted') {
        const lead = leads.find(l => l.id === leadId)
        if (lead) {
          setSelectedLeadForConversion(lead)
          setShowArcadasModal(true)
          return // Não atualizar ainda, esperar o modal
        }
      }

      // Para outros status, fazer a mudança normal
      setUpdatingStatus(leadId)

      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId)

      if (error) {
        throw error
      }

      setLeads(prev => prev.map(lead =>
        lead.id === leadId
          ? { ...lead, status: newStatus as any, updated_at: new Date().toISOString() }
          : lead
      ))

      toast.success('Status atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  // E corrigir o handleConfirmConversion para usar a lógica correta:
  const handleConfirmConversion = async (arcadas: number) => {
    if (!selectedLeadForConversion) return

    try {
      setUpdatingStatus(selectedLeadForConversion.id)

      // Atualizar o lead
      const updateData = {
        status: 'converted' as const,
        arcadas_vendidas: arcadas,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', selectedLeadForConversion.id)

      if (error) throw error

      // Calcular comissão baseada nas arcadas
      const valorPorArcada = 750
      const comissaoConsultor = arcadas * valorPorArcada

      // Criar comissão do consultor
      await supabase
        .from('commissions')
        .insert({
          lead_id: selectedLeadForConversion.id,
          user_id: selectedLeadForConversion.indicated_by,
          amount: comissaoConsultor,
          clinic_id: selectedLeadForConversion.clinic_id,
          percentage: 100,
          type: 'consultant',
          status: 'pending',
        })

      // Se houver gerente, criar comissão do gerente (10% do valor total)
      const { data: hierarchy } = await supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', selectedLeadForConversion.indicated_by)
        .single()

      if (hierarchy?.manager_id) {
        const comissaoGerente = comissaoConsultor * 0.10
        await supabase
          .from('commissions')
          .insert({
            lead_id: selectedLeadForConversion.id,
            user_id: hierarchy.manager_id,
            amount: comissaoGerente,
            clinic_id: selectedLeadForConversion.clinic_id,
            percentage: 10,
            type: 'manager',
            status: 'pending',
          })
      }

      toast.success(`Lead convertido! ${arcadas} arcada${arcadas > 1 ? 's' : ''} vendida${arcadas > 1 ? 's' : ''}!`)

      // Atualizar a lista local
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLeadForConversion.id
          ? { ...lead, ...updateData } as Lead
          : lead
      ))

      // Fechar modal
      setShowArcadasModal(false)
      setSelectedLeadForConversion(null)

    } catch (error: any) {
      console.error('Erro ao converter lead:', error)
      toast.error('Erro ao converter lead')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleViewLead = (leadId: string) => {
    setSelectedLeadId(leadId)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedLeadId(null)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircleIcon className="h-4 w-4" />
      case 'lost':
        return <XCircleIcon className="h-4 w-4" />
      default:
        return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Novo',
      contacted: 'Contatado',
      qualified: 'Qualificado',
      negotiation: 'Negociação',
      converted: 'Convertido',
      lost: 'Perdido'
    }
    return labels[status] || status
  }

  const handleUpdateStatus = async (leadId: string, newStatus: string, arcadas?: number) => {
    try {
      // Se está marcando como convertido e não passou arcadas, abrir modal
      if (newStatus === 'converted' && !arcadas) {
        const lead = leads.find(l => l.id === leadId)
        if (lead) {
          setSelectedLeadForConversion(lead)
          setShowArcadasModal(true)
          return
        }
      }

      // Atualizar o lead
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Se for conversão, adicionar arcadas
      if (newStatus === 'converted' && arcadas) {
        updateData.arcadas_vendidas = arcadas
        updateData.converted_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)

      if (error) throw error

      // Se converteu, criar comissão apenas para leads convertidos
      if (newStatus === 'converted' && arcadas) {
        const lead = leads.find(l => l.id === leadId)
        if (lead) {
          // Calcular comissão baseada nas arcadas
          const valorPorArcada = 750
          const comissaoConsultor = arcadas * valorPorArcada

          // Criar comissão do consultor
          await supabase
            .from('commissions')
            .insert({
              lead_id: leadId,
              user_id: lead.indicated_by, // CORREÇÃO: usar indicated_by em vez de consultant_id
              amount: comissaoConsultor,
              clinic_id: lead.clinic_id,
              percentage: 100, // 100% do valor por arcada
              type: 'consultant',
              status: 'pending',
            })

          // Se houver gerente, criar comissão do gerente (10% do valor total)
          const { data: hierarchy } = await supabase
            .from('hierarchies')
            .select('manager_id')
            .eq('consultant_id', lead.indicated_by)
            .single()

          if (hierarchy?.manager_id) {
            const comissaoGerente = comissaoConsultor * 0.10
            await supabase
              .from('commissions')
              .insert({
                lead_id: leadId,
                user_id: hierarchy.manager_id,
                amount: comissaoGerente,
                clinic_id: lead.clinic_id,
                percentage: 10,
                type: 'manager',
                status: 'pending',
              })
          }
        }
      }

      toast.success(`Status atualizado para ${getStatusLabel(newStatus)}`)
      fetchLeads()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }


  const getStatusColor = (status: string) => {
    const option = statusOptions.find(opt => opt.value === status)
    return option?.color || 'secondary'
  }

  // Filtrar leads com novos filtros
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm ||
      lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      lead.cpf?.includes(searchTerm)

    const matchesStatus = !statusFilter || lead.status === statusFilter
    const matchesState = !stateFilter || lead.state === stateFilter
    const matchesConsultant = !consultantFilter || lead.indicated_by === consultantFilter

    const matchesDate = !dateFilter || new Date(lead.created_at).toDateString() === new Date(dateFilter).toDateString()

    return matchesSearch && matchesStatus && matchesState && matchesConsultant && matchesDate
  })

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    converted: leads.filter(l => l.status === 'converted').length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1) : '0'
  }

  const canEdit = profile?.role === 'clinic_admin' || profile?.role === 'manager'
  const canCreate = profile?.role !== 'clinic_viewer'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {profile?.role === 'consultant' ? 'Meus Leads' : 'Leads'}
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'consultant'
              ? 'Gerencie suas indicações'
              : 'Gerencie todos os leads da clínica'
            }
          </p>
        </div>

        {canCreate && (
          <Link href="/dashboard/leads/new" className="btn btn-primary">
            <PlusIcon className="h-4 w-4 mr-2" />
            Novo Lead
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-600">{stats.total}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Total</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-600">{stats.new}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Novos</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-warning-600">{stats.contacted}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Contatados</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-success-600">{stats.converted}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Convertidos</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-16 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-success-600">{stats.conversionRate}%</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Conversão</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email, telefone..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos os status</option>
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">Todos os estados</option>
              {states.map(state => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>

            {(profile?.role === 'clinic_admin' || profile?.role === 'clinic_viewer' || profile?.role === 'manager') && (
              <select
                className="input"
                value={consultantFilter}
                onChange={(e) => setConsultantFilter(e.target.value)}
              >
                <option value="">Todos os consultores</option>
                {consultants.map(consultant => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.full_name}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              className="input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setStateFilter('')
                setConsultantFilter('')
                setDateFilter('')
              }}
              className="btn btn-secondary"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Leads Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Contato</th>
                  {/* <th>Estado</th> */}
                  <th>Status</th>
                  {profile?.role !== 'consultant' && <th>Indicado por</th>}
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-secondary-900">
                            {lead.full_name}
                          </div>
                          {lead.age && (
                            <div className="text-sm text-secondary-500">
                              {lead.age} anos
                              {lead.gender && (
                                <span className="ml-1">
                                  • {lead.gender === 'male' ? 'M' : lead.gender === 'female' ? 'F' : 'Outro'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <PhoneIcon className="h-3 w-3 text-secondary-400 mr-1" />
                          <span className="text-sm">{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center">
                            <EnvelopeIcon className="h-3 w-3 text-secondary-400 mr-1" />
                            <span className="text-sm">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {/* <td>
                      <div className="flex items-center">
                        <MapPinIcon className="h-4 w-4 text-secondary-400 mr-2" />
                        <div>
                          {lead.state && (
                            <div className="text-sm font-medium text-secondary-900">
                              {lead.state}
                            </div>
                          )}
                          {lead.city && (
                            <div className="text-xs text-secondary-500">
                              {lead.city}
                            </div>
                          )}
                          {!lead.state && !lead.city && (
                            <span className="text-sm text-secondary-400">Não informado</span>
                          )}
                        </div>
                      </div>
                    </td> */}
                    <td>
                      {canEdit ? (
                        <select
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          disabled={updatingStatus === lead.id}
                          className={`badge badge-${getStatusColor(lead.status)} cursor-pointer hover:opacity-80 border-0 text-xs`}
                        >
                          {statusOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge badge-${getStatusColor(lead.status)} flex items-center`}>
                          {getStatusIcon(lead.status)}
                          <span className="ml-1">
                            {statusOptions.find(opt => opt.value === lead.status)?.label}
                          </span>
                        </span>
                      )}
                    </td>
                    {profile?.role !== 'consultant' && (
                      <td>
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-success-600 flex items-center justify-center mr-3">
                            <span className="text-xs font-medium text-white">
                              {lead.users?.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-secondary-900">
                              {lead.users?.full_name}
                            </div>
                            <div className="text-xs text-secondary-500">
                              {lead.users?.email}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="text-sm text-secondary-900">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-secondary-500">
                        {new Date(lead.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewLead(lead.id)}
                          className="btn btn-ghost btn-sm"
                          title="Visualizar"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <Link
                            href={`/dashboard/leads/${lead.id}/edit`}
                            className="btn btn-ghost btn-sm"
                            title="Editar"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-center py-12">
                <div className="text-secondary-400 mb-4">
                  {leads.length === 0 ? (
                    <ClockIcon className="mx-auto h-12 w-12" />
                  ) : (
                    <MagnifyingGlassIcon className="mx-auto h-12 w-12" />
                  )}
                </div>
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {leads.length === 0 ? 'Nenhum lead encontrado' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {leads.length === 0
                    ? 'Comece criando seu primeiro lead.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
                {leads.length === 0 && canCreate && (
                  <Link
                    href="/dashboard/leads/new"
                    className="btn btn-primary mt-4"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Criar Primeiro Lead
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        leadId={selectedLeadId}
        onLeadUpdate={fetchLeads}
      />

      {showArcadasModal && selectedLeadForConversion && (
        <ArcadasModal
          isOpen={showArcadasModal}
          onClose={() => {
            setShowArcadasModal(false)
            setSelectedLeadForConversion(null)
          }}
          onConfirm={handleConfirmConversion}
          leadName={selectedLeadForConversion.full_name}
        />
      )}
    </div>
  )
}