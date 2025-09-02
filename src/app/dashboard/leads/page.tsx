// src/app/dashboard/leads/page.tsx - NOVA VERSÃO COM LISTAGEM COMPLETA
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  ChartBarIcon,
  UserIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  TrophyIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import ArcadasModal from '@/components/leads/ArcadasModal'

interface Lead {
  id: string
  full_name: string
  email: string | null
  phone: string
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'lost'
  created_at: string
  updated_at: string
  converted_at?: string
  arcadas_vendidas?: number
  notes?: string
  indicated_by: string
  clinic_id: string
  establishment_code?: string
  users?: {
    full_name: string
    email: string
  }
}

export default function LeadsListingPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [consultantFilter, setConsultantFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isArcadasModalOpen, setIsArcadasModalOpen] = useState(false)
  const [leadForConversion, setLeadForConversion] = useState<Lead | null>(null)
  const [consultants, setConsultants] = useState<Array<{ id: string, full_name: string }>>([])
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchLeads()
      fetchConsultants()
    }
  }, [profile])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      console.log('🔍 Buscando leads para role:', profile?.role)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) {
        toast.error('Clínica não encontrada')
        return
      }

      let leadsQuery = supabase
        .from('leads')
        .select(`
          *,
          users!leads_indicated_by_fkey (
            full_name,
            email
          )
        `)
        .eq('clinic_id', userClinic.clinic_id)
        .order('created_at', { ascending: false })

      // Filtrar por role
      if (profile?.role === 'consultant') {
        // Consultor vê apenas seus próprios leads
        leadsQuery = leadsQuery.eq('indicated_by', profile.id)
      } else if (profile?.role === 'manager') {
        // Manager vê leads de sua equipe
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id) // Incluir próprios leads

        if (consultantIds.length > 0) {
          leadsQuery = leadsQuery.in('indicated_by', consultantIds)
        }
      }
      // clinic_admin vê todos os leads da clínica (sem filtro adicional)

      const { data, error } = await leadsQuery

      if (error) {
        console.error('❌ Erro ao buscar leads:', error)
        throw error
      }

      console.log('✅ Leads encontrados:', data?.length || 0)
      setLeads(data || [])
    } catch (error: any) {
      console.error('❌ Erro geral ao buscar leads:', error)
      toast.error('Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }

  const fetchConsultants = async () => {
    try {
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      let consultantsQuery = supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'consultant')
        .eq('status', 'active')

      // Para managers, buscar apenas sua equipe
      if (profile?.role === 'manager') {
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id)

        if (consultantIds.length > 0) {
          consultantsQuery = consultantsQuery.in('id', consultantIds)
        }
      }

      const { data } = await consultantsQuery
      setConsultants(data || [])
    } catch (error) {
      console.error('Erro ao buscar consultores:', error)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    if (newStatus === 'converted') {
      const lead = leads.find(l => l.id === leadId)
      if (lead) {
        setLeadForConversion(lead)
        setIsArcadasModalOpen(true)
      }
      return
    }

    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          ...(newStatus === 'converted' ? { converted_at: new Date().toISOString() } : {})
        })
        .eq('id', leadId)

      if (error) throw error

      setLeads(prev => prev.map(lead =>
        lead.id === leadId
          ? { 
              ...lead, 
              status: newStatus,
              updated_at: new Date().toISOString(),
              ...(newStatus === 'converted' ? { converted_at: new Date().toISOString() } : {})
            }
          : lead
      ))

      toast.success('Status atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleArcadasConfirm = async (arcadas: number) => {
    if (!leadForConversion) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          arcadas_vendidas: arcadas,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadForConversion.id)

      if (error) throw error

      // Atualizar lista local
      setLeads(prev => prev.map(lead =>
        lead.id === leadForConversion.id
          ? {
              ...lead,
              status: 'converted' as const,
              arcadas_vendidas: arcadas,
              converted_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          : lead
      ))

      // TODO: Aqui você pode adicionar a lógica de comissão que já existe no seu sistema
      toast.success(`Lead convertido! ${arcadas} arcada${arcadas > 1 ? 's' : ''} vendida${arcadas > 1 ? 's' : ''}!`)
      
      setLeadForConversion(null)
    } catch (error: any) {
      console.error('Erro ao converter lead:', error)
      toast.error('Erro ao converter lead')
    }
  }

  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead)
    setIsDetailModalOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircleIcon className="h-4 w-4" />
      case 'lost':
        return <XCircleIcon className="h-4 w-4" />
      case 'scheduled':
        return <CalendarIcon className="h-4 w-4" />
      case 'contacted':
        return <PhoneIcon className="h-4 w-4" />
      default:
        return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'new': 'Novo',
      'contacted': 'Contatado',
      'scheduled': 'Agendado',
      'converted': 'Convertido',
      'lost': 'Perdido'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'secondary',
      'contacted': 'warning',
      'scheduled': 'primary',
      'converted': 'success',
      'lost': 'danger'
    }
    return colors[status] || 'secondary'
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm ||
      lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.users?.full_name.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = !statusFilter || lead.status === statusFilter
    const matchesConsultant = !consultantFilter || lead.indicated_by === consultantFilter
    const matchesDate = !dateFilter || lead.created_at.startsWith(dateFilter)

    return matchesSearch && matchesStatus && matchesConsultant && matchesDate
  })

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    conversionRate: leads.length > 0 ? (leads.filter(l => l.status === 'converted').length / leads.length) * 100 : 0,
    totalArcadas: leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)
  }

  const canCreateLeads = profile?.role === 'clinic_admin' || profile?.role === 'manager' || profile?.role === 'consultant'
  const canEditLeads = profile?.role === 'clinic_admin' || profile?.role === 'manager'

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
          <h1 className="text-2xl font-bold text-secondary-900">Leads</h1>
          <p className="text-secondary-600">
            {profile?.role === 'consultant' 
              ? 'Seus leads e indicações' 
              : profile?.role === 'manager'
              ? 'Leads da sua equipe'
              : 'Todos os leads da clínica'
            }
          </p>
        </div>

        {canCreateLeads && (
          <Link href="/dashboard/leads/new" className="btn btn-primary">
            <UserPlusIcon className="h-4 w-4 mr-2" />
            Novo Lead
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
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
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Total</p>
                <p className="text-xs text-secondary-400">Leads</p>
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
                <div className="w-8 h-8 bg-secondary-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-secondary-600">{stats.new}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Novos</p>
                <p className="text-xs text-secondary-400">Leads</p>
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
                  <span className="text-sm font-bold text-warning-600">{stats.contacted + stats.scheduled}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Em Processo</p>
                <p className="text-xs text-secondary-400">Leads</p>
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
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Convertidos</p>
                <p className="text-xs text-secondary-400">Leads</p>
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
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Taxa Conversão</p>
                <p className="text-xs font-bold text-primary-600">{stats.conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <TrophyIcon className="w-4 h-4 text-success-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Arcadas</p>
                <p className="text-xs font-bold text-success-600">{stats.totalArcadas}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou email..."
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
              <option value="new">Novo</option>
              <option value="contacted">Contatado</option>
              <option value="scheduled">Agendado</option>
              <option value="converted">Convertido</option>
              <option value="lost">Perdido</option>
            </select>

            {(profile?.role === 'clinic_admin' || profile?.role === 'manager') && (
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

      {/* Leads Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card"
      >
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Contato</th>
                  <th>Consultor</th>
                  <th>Status</th>
                  <th>Data</th>
                  {stats.converted > 0 && <th>Arcadas</th>}
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-secondary-50">
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {lead.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">
                            {lead.full_name}
                          </div>
                          {lead.notes && (
                            <div className="text-xs text-secondary-500 max-w-xs truncate">
                              {lead.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <PhoneIcon className="h-3 w-3 text-secondary-400 mr-1" />
                          {lead.phone}
                        </div>
                        {lead.email && (
                          <div className="flex items-center text-sm">
                            <EnvelopeIcon className="h-3 w-3 text-secondary-400 mr-1" />
                            {lead.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="text-sm font-medium text-secondary-900">
                          {lead.users?.full_name || 'N/A'}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {lead.users?.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      {canEditLeads || lead.indicated_by === profile?.id ? (
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs badge-${getStatusColor(lead.status)}`}
                        >
                          <option value="new">Novo</option>
                          <option value="contacted">Contatado</option>
                          <option value="scheduled">Agendado</option>
                          <option value="converted">Convertido</option>
                          <option value="lost">Perdido</option>
                        </select>
                      ) : (
                        <span className={`badge badge-${getStatusColor(lead.status)} flex items-center`}>
                          {getStatusIcon(lead.status)}
                          <span className="ml-1">{getStatusLabel(lead.status)}</span>
                        </span>
                      )}
                    </td>
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
                      {lead.converted_at && (
                        <div className="text-xs text-success-600">
                          Convertido: {new Date(lead.converted_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>
                    {stats.converted > 0 && (
                      <td>
                        {lead.status === 'converted' ? (
                          <div className="flex items-center">
                            <TrophyIcon className="h-4 w-4 text-warning-500 mr-1" />
                            <span className="font-medium text-primary-600">
                              {lead.arcadas_vendidas || 1}
                            </span>
                          </div>
                        ) : (
                          <span className="text-secondary-400">-</span>
                        )}
                      </td>
                    )}
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewLead(lead)}
                          className="btn btn-ghost btn-sm"
                          title="Ver detalhes"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {(canEditLeads || lead.indicated_by === profile?.id) && (
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
                <UserIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {leads.length === 0 ? 'Nenhum lead encontrado' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {leads.length === 0
                    ? 'Comece criando seu primeiro lead.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
                {leads.length === 0 && canCreateLeads && (
                  <Link href="/dashboard/leads/new" className="btn btn-primary mt-4">
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Criar Primeiro Lead
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Performance Summary para admins/managers */}
      {(profile?.role === 'clinic_admin' || profile?.role === 'manager') && leads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card"
        >
          <div className="card-body">
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Resumo de Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ChartBarIcon className="h-6 w-6 text-primary-600" />
                </div>
                <h4 className="font-medium text-secondary-900 mb-2">Taxa de Conversão</h4>
                <p className="text-2xl font-bold text-primary-600">{stats.conversionRate.toFixed(1)}%</p>
                <p className="text-sm text-secondary-600">
                  {stats.converted} de {stats.total} leads convertidos
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrophyIcon className="h-6 w-6 text-success-600" />
                </div>
                <h4 className="font-medium text-secondary-900 mb-2">Arcadas Vendidas</h4>
                <p className="text-2xl font-bold text-success-600">{stats.totalArcadas}</p>
                <p className="text-sm text-secondary-600">
                  Total de arcadas convertidas
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CurrencyDollarIcon className="h-6 w-6 text-warning-600" />
                </div>
                <h4 className="font-medium text-secondary-900 mb-2">Receita Estimada</h4>
                <p className="text-2xl font-bold text-warning-600">
                  R$ {(stats.totalArcadas * 750).toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-secondary-600">
                  Baseado em R$ 750 por arcada
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false)
          setSelectedLead(null)
        }}
        leadId={selectedLead?.id || null}
        onLeadUpdate={fetchLeads}
      />

      {/* Arcadas Modal */}
      <ArcadasModal
        isOpen={isArcadasModalOpen}
        onClose={() => {
          setIsArcadasModalOpen(false)
          setLeadForConversion(null)
        }}
        onConfirm={handleArcadasConfirm}
        leadName={leadForConversion?.full_name || ''}
        establishmentCode={leadForConversion?.establishment_code}
        consultantId={leadForConversion?.indicated_by}
      />
    </div>
  )
}