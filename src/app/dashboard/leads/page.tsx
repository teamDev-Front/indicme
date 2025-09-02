// src/app/dashboard/leads/page.tsx - PÁGINA COMPLETA DE LEADS
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  LinkIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UserIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import Link from 'next/link'
import LeadDetailModal from '@/components/leads/LeadDetailModal'
import ArcadasModal from '@/components/leads/ArcadasModal'

interface Lead {
  id: string
  full_name: string
  phone: string
  email: string | null
  cpf: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  notes: string | null
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'lost'
  indicated_by: string
  clinic_id: string
  establishment_code: string | null
  arcadas_vendidas: number | null
  converted_at: string | null
  created_at: string
  updated_at: string
  users?: {
    id: string
    full_name: string
    email: string
    role: string
  }
  commissions?: {
    id: string
    amount: number
    status: string
    type: string
  }[]
}

export default function LeadsPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [consultantFilter, setConsultantFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [establishmentFilter, setEstablishmentFilter] = useState('')
  
  // Estados dos modais
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [isArcadasModalOpen, setIsArcadasModalOpen] = useState(false)
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null)
  
  const [submitting, setSubmitting] = useState(false)
  const [consultants, setConsultants] = useState<{ id: string, name: string }[]>([])
  const [establishments, setEstablishments] = useState<string[]>([])
  
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchLeads()
      fetchFiltersData()
    }
  }, [profile])

  const fetchLeads = async () => {
    try {
      setLoading(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      let leadsQuery = supabase
        .from('leads')
        .select(`
          *,
          users!leads_indicated_by_fkey (
            id,
            full_name,
            email,
            role
          ),
          commissions (
            id,
            amount,
            status,
            type
          )
        `)
        .eq('clinic_id', userClinic.clinic_id)
        .order('created_at', { ascending: false })

      // Filtros por role
      if (profile?.role === 'consultant') {
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

      const { data, error } = await leadsQuery

      if (error) throw error

      setLeads(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar leads:', error)
      toast.error('Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }

  const fetchFiltersData = async () => {
    try {
      // Buscar consultores para filtro
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      let consultantsQuery = supabase
        .from('users')
        .select('id, full_name, user_clinics!inner(clinic_id)')
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .in('role', ['consultant', 'manager'])
        .order('full_name')

      // Para managers, mostrar apenas sua equipe
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

      const { data: consultantsData } = await consultantsQuery
      setConsultants(consultantsData?.map(c => ({ id: c.id, name: c.full_name })) || [])

      // Buscar estabelecimentos únicos
      const establishmentCodes = leads
        .map(lead => lead.establishment_code)
        .filter((code): code is string => code !== null && code !== undefined)
      
      const uniqueEstablishments = Array.from(new Set(establishmentCodes))

      setEstablishments(uniqueEstablishments)
    } catch (error) {
      console.error('Erro ao buscar dados dos filtros:', error)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (error) throw error

      setLeads(prev => prev.map(lead =>
        lead.id === leadId
          ? { ...lead, status: newStatus as any }
          : lead
      ))

      toast.success('Status atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleConvertLead = (lead: Lead) => {
    setLeadToConvert(lead)
    setIsArcadasModalOpen(true)
  }

  const handleConfirmConversion = async (arcadas: number) => {
    if (!leadToConvert) return

    try {
      setSubmitting(true)

      // Buscar establishment_code do consultor se não existir
      let establishmentCode = leadToConvert.establishment_code

      if (!establishmentCode) {
        const { data: userEstablishment } = await supabase
          .from('user_establishments')
          .select('establishment_code')
          .eq('user_id', leadToConvert.indicated_by)
          .eq('status', 'active')
          .single()

        establishmentCode = userEstablishment?.establishment_code || null
      }

      // Atualizar lead
      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          arcadas_vendidas: arcadas,
          establishment_code: establishmentCode,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadToConvert.id)

      if (leadError) throw leadError

      // Buscar configurações do estabelecimento
      const { data: settings } = await supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      const consultantValuePerArcada = settings?.consultant_value_per_arcada || 750
      const managerValuePerArcada = settings?.manager_value_per_arcada || 750
      const managerBonusActive = settings?.manager_bonus_active !== false

      // Calcular comissão do consultor
      const valorBaseConsultor = arcadas * consultantValuePerArcada

      // Criar comissão do consultor
      const { error: commissionError } = await supabase
        .from('commissions')
        .insert({
          lead_id: leadToConvert.id,
          user_id: leadToConvert.indicated_by,
          clinic_id: leadToConvert.clinic_id,
          establishment_code: establishmentCode,
          amount: valorBaseConsultor,
          percentage: 0,
          type: 'consultant',
          status: 'pending',
          arcadas_vendidas: arcadas,
          valor_por_arcada: consultantValuePerArcada,
        })

      if (commissionError) throw commissionError

      // Verificar se tem gerente e criar comissão
      const { data: hierarchy } = await supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', leadToConvert.indicated_by)
        .single()

      if (hierarchy?.manager_id && managerBonusActive) {
        const valorBaseGerente = arcadas * managerValuePerArcada

        await supabase
          .from('commissions')
          .insert({
            lead_id: leadToConvert.id,
            user_id: hierarchy.manager_id,
            clinic_id: leadToConvert.clinic_id,
            establishment_code: establishmentCode,
            amount: valorBaseGerente,
            percentage: 0,
            type: 'manager',
            status: 'pending',
            arcadas_vendidas: arcadas,
            valor_por_arcada: managerValuePerArcada,
          })
      }

      toast.success(`Lead convertido! ${arcadas} arcada${arcadas > 1 ? 's' : ''} vendida${arcadas > 1 ? 's' : ''}!`)
      fetchLeads()
    } catch (error: any) {
      console.error('Erro ao converter lead:', error)
      toast.error('Erro ao converter lead')
    } finally {
      setSubmitting(false)
      setLeadToConvert(null)
    }
  }

  const handleDeleteLead = async () => {
    if (!selectedLead) return

    try {
      setSubmitting(true)

      // Verificar se lead foi convertido
      if (selectedLead.status === 'converted') {
        toast.error('Não é possível excluir um lead convertido')
        return
      }

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', selectedLead.id)

      if (error) throw error

      setLeads(prev => prev.filter(lead => lead.id !== selectedLead.id))
      setIsDeleteModalOpen(false)
      setSelectedLead(null)
      toast.success('Lead removido com sucesso!')
    } catch (error: any) {
      console.error('Erro ao deletar lead:', error)
      toast.error('Erro ao remover lead')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewLead = (leadId: string) => {
    setSelectedLeadId(leadId)
    setIsDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedLeadId(null)
  }

  // Filtros aplicados
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !searchTerm ||
      lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = !statusFilter || lead.status === statusFilter

    const matchesConsultant = !consultantFilter || lead.indicated_by === consultantFilter

    const matchesEstablishment = !establishmentFilter || lead.establishment_code === establishmentFilter

    const matchesDate = !dateFilter || new Date(lead.created_at).toISOString().split('T')[0] === dateFilter

    return matchesSearch && matchesStatus && matchesConsultant && matchesEstablishment && matchesDate
  })

  // Estatísticas
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    scheduled: leads.filter(l => l.status === 'scheduled').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost: leads.filter(l => l.status === 'lost').length,
    conversionRate: leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1) : '0',
    totalArcadas: leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 0), 0),
    totalCommissions: leads.reduce((sum, l) => sum + (l.commissions?.reduce((commSum, c) => commSum + (c.status === 'paid' ? c.amount : 0), 0) || 0), 0)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircleIcon className="h-4 w-4 text-success-600" />
      case 'lost':
        return <XCircleIcon className="h-4 w-4 text-danger-600" />
      case 'scheduled':
        return <CalendarIcon className="h-4 w-4 text-primary-600" />
      case 'contacted':
        return <PhoneIcon className="h-4 w-4 text-warning-600" />
      default:
        return <ClockIcon className="h-4 w-4 text-secondary-600" />
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'converted': return 'success'
      case 'lost': return 'danger'
      case 'scheduled': return 'primary'
      case 'contacted': return 'warning'
      default: return 'secondary'
    }
  }

  const canEdit = profile?.role === 'clinic_admin' || profile?.role === 'manager' ||
    (profile?.role === 'consultant')

  const canCreate = canEdit

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
            {profile?.role === 'consultant' ? 'Meus Leads' : 'Todos os Leads'}
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'consultant' 
              ? 'Gerencie suas indicações e acompanhe conversões'
              : 'Visualize e gerencie todos os leads da clínica'
            }
          </p>
        </div>

        {canCreate && (
          <Link
            href="/dashboard/leads/new"
            className="btn btn-primary"
          >
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
                  <span className="text-sm font-bold text-warning-600">{stats.contacted}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Contatados</p>
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
                  <span className="text-sm font-bold text-primary-600">{stats.conversionRate}%</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Taxa</p>
                <p className="text-xs text-secondary-400">Conversão</p>
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
                  <span className="text-sm font-bold text-success-600">{stats.totalArcadas}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Arcadas</p>
                <p className="text-xs text-secondary-400">Vendidas</p>
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
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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

            {profile?.role !== 'consultant' && (
              <select
                className="input"
                value={consultantFilter}
                onChange={(e) => setConsultantFilter(e.target.value)}
              >
                <option value="">Todos os consultores</option>
                {consultants.map(consultant => (
                  <option key={consultant.id} value={consultant.id}>
                    {consultant.name}
                  </option>
                ))}
              </select>
            )}

            <select
              className="input"
              value={establishmentFilter}
              onChange={(e) => setEstablishmentFilter(e.target.value)}
            >
              <option value="">Todos estabelecimentos</option>
              {establishments.map(establishment => (
                <option key={establishment} value={establishment}>
                  {establishment}
                </option>
              ))}
            </select>

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
                setEstablishmentFilter('')
                setDateFilter('')
              }}
              className="btn btn-secondary"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Limpar
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
                  {profile?.role !== 'consultant' && <th>Consultor</th>}
                  <th>Status</th>
                  <th>Resultado</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id}>
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
                          <div className="text-sm text-secondary-500">
                            {lead.age && `${lead.age} anos`}
                            {lead.city && lead.state && ` • ${lead.city}, ${lead.state}`}
                          </div>
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
                    {profile?.role !== 'consultant' && (
                      <td>
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-success-600 flex items-center justify-center mr-3">
                            <span className="text-xs font-medium text-white">
                              {lead.users?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-secondary-900">
                              {lead.users?.full_name || 'Usuário não encontrado'}
                            </div>
                            <div className="text-xs text-secondary-500">
                              {lead.users?.role === 'manager' ? 'Gerente' : 'Consultor'}
                            </div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      {canEdit ? (
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs ${
                            lead.status === 'converted' ? 'badge-success' :
                            lead.status === 'lost' ? 'badge-danger' :
                            lead.status === 'scheduled' ? 'badge-primary' :
                            lead.status === 'contacted' ? 'badge-warning' :
                            'badge-secondary'
                          }`}
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
                          <span className="ml-1">
                            {getStatusLabel(lead.status)}
                          </span>
                        </span>
                      )}
                    </td>
                    <td>
                      {lead.status === 'converted' ? (
                        <div className="text-center">
                          <div className="text-sm font-medium text-success-600">
                            {lead.arcadas_vendidas || 1} arcada{(lead.arcadas_vendidas || 1) > 1 ? 's' : ''}
                          </div>
                          <div className="text-xs text-success-500">
                            R$ {((lead.arcadas_vendidas || 1) * 750).toLocaleString('pt-BR')}
                          </div>
                          {lead.converted_at && (
                            <div className="text-xs text-secondary-500">
                              {new Date(lead.converted_at).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </div>
                      ) : lead.status === 'lost' ? (
                        <div className="text-center">
                          <div className="text-sm text-danger-600">Lead perdido</div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-sm text-secondary-500">Aguardando</div>
                          {canEdit && (
                            <button
                              onClick={() => handleConvertLead(lead)}
                              className="text-xs text-success-600 hover:text-success-700 mt-1 block"
                            >
                              Converter
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <div className="text-sm text-secondary-900">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {new Date(lead.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewLead(lead.id)}
                          className="btn btn-ghost btn-sm"
                          title="Ver Detalhes"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <Link
                              href={`/dashboard/leads/${lead.id}/edit`}
                              className="btn btn-ghost btn-sm"
                              title="Editar"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                            {lead.status !== 'converted' && (
                              <button
                                onClick={() => {
                                  setSelectedLead(lead)
                                  setIsDeleteModalOpen(true)
                                }}
                                className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                                title="Remover"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </>
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
                    ? 'Comece adicionando seu primeiro lead.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
                {leads.length === 0 && canCreate && (
                  <Link
                    href="/dashboard/leads/new"
                    className="btn btn-primary mt-4"
                  >
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Lead
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Performance Summary */}
      {stats.converted > 0 && (
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-success-600 mb-1">
                  {stats.converted}
                </div>
                <div className="text-sm text-secondary-600">Leads Convertidos</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600 mb-1">
                  {stats.totalArcadas}
                </div>
                <div className="text-sm text-secondary-600">Arcadas Vendidas</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-warning-600 mb-1">
                  {stats.conversionRate}%
                </div>
                <div className="text-sm text-secondary-600">Taxa de Conversão</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-success-600 mb-1">
                  R$ {stats.totalCommissions.toLocaleString('pt-BR')}
                </div>
                <div className="text-sm text-secondary-600">Comissões Geradas</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        leadId={selectedLeadId}
        onLeadUpdate={fetchLeads}
      />

      {/* Arcadas Modal para conversão */}
      <ArcadasModal
        isOpen={isArcadasModalOpen}
        onClose={() => {
          setIsArcadasModalOpen(false)
          setLeadToConvert(null)
        }}
        onConfirm={handleConfirmConversion}
        leadName={leadToConvert?.full_name || ''}
        establishmentCode={leadToConvert?.establishment_code || undefined}
        consultantId={leadToConvert?.indicated_by}
      />

      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 mr-3" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                      Confirmar Exclusão
                    </Dialog.Title>
                  </div>

                  <p className="text-sm text-secondary-500 mb-6">
                    Tem certeza que deseja remover o lead <strong>{selectedLead?.full_name}</strong>?
                    Esta ação não pode ser desfeita.
                  </p>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleDeleteLead}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Removendo...
                        </>
                      ) : (
                        'Remover Lead'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}