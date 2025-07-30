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
  CurrencyDollarIcon,
  StarIcon,
  PlayIcon,
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
  establishment_code?: string
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

  // 🔥 NOVA FUNÇÃO: Conversão direta com modal de arcadas
  const handleQuickConvert = (lead: Lead) => {
    console.log('🎯 Iniciando conversão rápida para lead:', lead.full_name)
    setSelectedLeadForConversion(lead)
    setShowArcadasModal(true)
  }

  // src/app/dashboard/leads/page.tsx - FUNÇÃO CORRIGIDA
  // src/app/dashboard/leads/page.tsx - FUNÇÃO CORRIGIDA (linhas ~210-320)

  const handleConfirmConversion = async (arcadas: number) => {
    if (!selectedLeadForConversion) return

    try {
      console.log('🎯 Iniciando conversão para lead:', selectedLeadForConversion.full_name)
      console.log('📊 Arcadas selecionadas:', arcadas)

      // 1. CRUCIAL: Verificar se o lead já está convertido para evitar duplicação
      const { data: currentLead, error: checkError } = await supabase
        .from('leads')
        .select('status, arcadas_vendidas')
        .eq('id', selectedLeadForConversion.id)
        .single()

      if (checkError) {
        console.error('❌ Erro ao verificar status do lead:', checkError)
        throw checkError
      }

      if (currentLead.status === 'converted') {
        console.log('⚠️ Lead já convertido, evitando duplicação')
        toast.error('Este lead já foi convertido!')
        setShowArcadasModal(false)
        setSelectedLeadForConversion(null)
        return
      }

      console.log('✅ Lead ainda não convertido, prosseguindo...')

      // 2. Buscar o establishment_code do consultor
      const { data: userEstablishment } = await supabase
        .from('user_establishments')
        .select('establishment_code')
        .eq('user_id', selectedLeadForConversion.indicated_by)
        .eq('status', 'active')
        .single()

      const establishmentCode = userEstablishment?.establishment_code
      console.log('🏢 Establishment code:', establishmentCode)

      // 3. Atualizar o lead COM establishment_code
      const updateData = {
        status: 'converted' as const,
        arcadas_vendidas: arcadas,
        establishment_code: establishmentCode,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', selectedLeadForConversion.id)

      if (updateError) {
        console.error('❌ Erro ao atualizar lead:', updateError)
        throw updateError
      }

      console.log('✅ Lead atualizado com sucesso')

      // 4. Verificar se já existem comissões para este lead (evitar duplicação)
      const { data: existingCommissions, error: commissionsCheckError } = await supabase
        .from('commissions')
        .select('id, amount, type')
        .eq('lead_id', selectedLeadForConversion.id)

      if (commissionsCheckError) {
        console.error('❌ Erro ao verificar comissões existentes:', commissionsCheckError)
        throw commissionsCheckError
      }

      if (existingCommissions && existingCommissions.length > 0) {
        console.log('⚠️ Comissões já existem para este lead:', existingCommissions)
        toast.error('Lead convertido, mas comissões já existiam para este lead!')

        // Atualizar lista local e fechar modal
        setLeads(prev => prev.map(lead =>
          lead.id === selectedLeadForConversion.id
            ? { ...lead, ...updateData } as Lead
            : lead
        ))

        setShowArcadasModal(false)
        setSelectedLeadForConversion(null)
        return
      }

      console.log('✅ Nenhuma comissão existente, criando novas...')

      // 5. Buscar configurações específicas do estabelecimento
      const { data: settings } = await supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      // 6. Configurações com fallback para valores padrão
      const consultantValuePerArcada = settings?.consultant_value_per_arcada || 750
      const managerValuePerArcada = settings?.manager_value_per_arcada || 750
      const managerBonusActive = settings?.manager_bonus_active !== false

      console.log('⚙️ Configurações:', {
        consultantValuePerArcada,
        managerValuePerArcada,
        managerBonusActive
      })

      // 7. Calcular comissão do consultor
      const comissaoConsultor = arcadas * consultantValuePerArcada

      // 8. Criar comissão do consultor COM establishment_code
      const { data: consultantCommissionData, error: consultantCommissionError } = await supabase
        .from('commissions')
        .insert({
          lead_id: selectedLeadForConversion.id,
          user_id: selectedLeadForConversion.indicated_by,
          clinic_id: selectedLeadForConversion.clinic_id,
          establishment_code: establishmentCode,
          amount: comissaoConsultor,
          percentage: 100,
          type: 'consultant',
          status: 'pending',
          arcadas_vendidas: arcadas,
          valor_por_arcada: consultantValuePerArcada
        })
        .select('id, amount')
        .single()

      if (consultantCommissionError) {
        console.error('❌ Erro ao criar comissão do consultor:', consultantCommissionError)
        throw consultantCommissionError
      }

      console.log('✅ Comissão do consultor criada:', consultantCommissionData)

      // 9. Se houver gerente, criar comissão do gerente
      const { data: hierarchy } = await supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', selectedLeadForConversion.indicated_by)
        .single()

      if (hierarchy?.manager_id) {
        console.log('👨‍💼 Gerente encontrado:', hierarchy.manager_id)

        // Comissão base independente do gerente
        const comissaoBaseGerente = arcadas * managerValuePerArcada

        let bonusGerente = 0

        // Calcular bônus apenas se ativo nas configurações
        if (managerBonusActive && settings) {
          console.log('🎁 Calculando bônus do gerente...')

          // Buscar total de arcadas da equipe do gerente neste estabelecimento
          const { data: teamHierarchy } = await supabase
            .from('hierarchies')
            .select('consultant_id')
            .eq('manager_id', hierarchy.manager_id)

          const teamIds = teamHierarchy?.map(h => h.consultant_id) || []
          teamIds.push(hierarchy.manager_id) // Incluir o próprio gerente

          // Buscar leads convertidos da equipe neste estabelecimento
          const { data: teamLeads } = await supabase
            .from('leads')
            .select('arcadas_vendidas')
            .in('indicated_by', teamIds)
            .eq('establishment_code', establishmentCode)
            .eq('status', 'converted')
            .neq('id', selectedLeadForConversion.id) // ⚠️ IMPORTANTE: Excluir o lead atual que acabou de ser convertido

          const totalArcadasEquipeAntes = teamLeads?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
          const totalArcadasEquipeDepois = totalArcadasEquipeAntes + arcadas

          console.log('📊 Arcadas da equipe:', {
            antes: totalArcadasEquipeAntes,
            depois: totalArcadasEquipeDepois,
            adicionadas: arcadas
          })

          // Verificar marcos de bônus (35, 50, 75 arcadas)
          const marcos = [
            { arcadas: 35, bonus: settings.manager_bonus_35_arcadas || 0 },
            { arcadas: 50, bonus: settings.manager_bonus_50_arcadas || 0 },
            { arcadas: 75, bonus: settings.manager_bonus_75_arcadas || 0 }
          ]

          for (const marco of marcos) {
            const marcosAntes = Math.floor(totalArcadasEquipeAntes / marco.arcadas)
            const marcosDepois = Math.floor(totalArcadasEquipeDepois / marco.arcadas)
            const novosMarcos = marcosDepois - marcosAntes

            if (novosMarcos > 0) {
              bonusGerente += novosMarcos * marco.bonus
              console.log(`🎁 Bônus ${marco.arcadas} arcadas: ${novosMarcos} x R$ ${marco.bonus} = R$ ${novosMarcos * marco.bonus}`)
            }
          }
        }

        const comissaoTotalGerente = comissaoBaseGerente + bonusGerente

        // Criar comissão do gerente apenas se houver valor
        if (comissaoTotalGerente > 0) {
          const { data: managerCommissionData, error: managerCommissionError } = await supabase
            .from('commissions')
            .insert({
              lead_id: selectedLeadForConversion.id,
              user_id: hierarchy.manager_id,
              clinic_id: selectedLeadForConversion.clinic_id,
              establishment_code: establishmentCode,
              amount: comissaoTotalGerente,
              percentage: 0,
              type: 'manager',
              status: 'pending',
              arcadas_vendidas: arcadas,
              valor_por_arcada: managerValuePerArcada,
              bonus_conquistados: bonusGerente > 0 ? 1 : 0,
              valor_bonus: bonusGerente
            })
            .select('id, amount')
            .single()

          if (managerCommissionError) {
            console.error('❌ Erro ao criar comissão do gerente:', managerCommissionError)
            // Não bloquear o processo se a comissão do gerente falhar
            console.log('⚠️ Continuando sem comissão do gerente')
          } else {
            console.log('✅ Comissão do gerente criada:', managerCommissionData)
          }
        }
      }

      // 10. Feedback de sucesso
      toast.success(`Lead convertido! ${arcadas} arcada${arcadas > 1 ? 's' : ''} vendida${arcadas > 1 ? 's' : ''}!`)

      // 11. Atualizar a lista local
      setLeads(prev => prev.map(lead =>
        lead.id === selectedLeadForConversion.id
          ? { ...lead, ...updateData } as Lead
          : lead
      ))

      // 12. Fechar modal
      setShowArcadasModal(false)
      setSelectedLeadForConversion(null)

      console.log('🎉 Conversão concluída com sucesso!')

    } catch (error: any) {
      console.error('❌ Erro completo ao converter lead:', error)
      toast.error(`Erro ao converter lead: ${error.message}`)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      // Se está marcando como convertido, abrir modal de arcadas
      if (newStatus === 'converted') {
        const lead = leads.find(l => l.id === leadId)
        if (lead) {
          handleQuickConvert(lead)
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
              ? 'Gerencie suas indicações e converta seus leads'
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
                          {/* 🔥 NOVO: Mostrar arcadas se convertido */}
                          {lead.status === 'converted' && lead.arcadas_vendidas && (
                            <div className="flex items-center mt-1">
                              <StarIcon className="h-3 w-3 text-success-500 mr-1" />
                              <span className="text-xs text-success-600 font-medium">
                                {lead.arcadas_vendidas} arcada{lead.arcadas_vendidas > 1 ? 's' : ''} vendida{lead.arcadas_vendidas > 1 ? 's' : ''}
                              </span>
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
                      {/* 🔥 NOVO: Mostrar data de conversão */}
                      {lead.status === 'converted' && lead.converted_at && (
                        <div className="text-xs text-success-600 mt-1">
                          💰 Convertido em {new Date(lead.converted_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        {/* 🔥 NOVO: Botão de conversão rápida para consultores */}
                        {profile?.role === 'consultant' && lead.status !== 'converted' && lead.status !== 'lost' && (
                          <button
                            onClick={() => handleQuickConvert(lead)}
                            className="btn btn-success btn-sm"
                            title="Converter Lead"
                          >
                            <PlayIcon className="h-4 w-4" />
                          </button>
                        )}

                        {/* 🔥 NOVO: Mostrar comissão estimada para leads convertidos */}
                        {lead.status === 'converted' && lead.arcadas_vendidas && (
                          <div className="flex items-center text-xs text-success-600 bg-success-50 px-2 py-1 rounded">
                            <CurrencyDollarIcon className="h-3 w-3 mr-1" />
                            <span className="font-medium">
                              R$ {(lead.arcadas_vendidas * 750).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        )}

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

      {/* 🔥 NOVO: Card de dicas para consultores */}
      {profile?.role === 'consultant' && leads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card"
        >
          <div className="card-body">
            <h3 className="text-lg font-medium text-secondary-900 mb-4 flex items-center">
              <StarIcon className="h-5 w-5 text-warning-500 mr-2" />
              Dicas para Converter Leads
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-primary-50 rounded-lg">
                <PlayIcon className="h-8 w-8 text-primary-600 mx-auto mb-2" />
                <h4 className="font-medium text-primary-900 mb-1">Conversão Rápida</h4>
                <p className="text-sm text-primary-700">
                  Use o botão ▶️ para converter leads rapidamente e calcular sua comissão automaticamente
                </p>
              </div>
              <div className="text-center p-4 bg-success-50 rounded-lg">
                <CurrencyDollarIcon className="h-8 w-8 text-success-600 mx-auto mb-2" />
                <h4 className="font-medium text-success-900 mb-1">Comissões Transparentes</h4>
                <p className="text-sm text-success-700">
                  Veja em tempo real quanto você ganhará por cada conversão, incluindo bônus por metas
                </p>
              </div>
              <div className="text-center p-4 bg-warning-50 rounded-lg">
                <StarIcon className="h-8 w-8 text-warning-600 mx-auto mb-2" />
                <h4 className="font-medium text-warning-900 mb-1">Sistema de Bônus</h4>
                <p className="text-sm text-warning-700">
                  Ganhe bônus extras a cada 7 arcadas vendidas. Acompanhe seu progresso nos detalhes
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        leadId={selectedLeadId}
        onLeadUpdate={fetchLeads}
      />

      {/* 🔥 MODAL DE ARCADAS MELHORADO */}
      {showArcadasModal && selectedLeadForConversion && (
        <ArcadasModal
          isOpen={showArcadasModal}
          onClose={() => {
            setShowArcadasModal(false)
            setSelectedLeadForConversion(null)
          }}
          onConfirm={handleConfirmConversion}
          leadName={selectedLeadForConversion.full_name}
          establishmentCode={selectedLeadForConversion.establishment_code}
          consultantId={selectedLeadForConversion.indicated_by}
        />
      )}
    </div>
  )
}