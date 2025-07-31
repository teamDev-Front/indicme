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


  // SUBSTITUA a função handleConfirmConversion no arquivo LeadsPage.tsx
  // Adicionando logs detalhados para debug

  const handleConfirmConversion = async (arcadas: number) => {
    if (!selectedLeadForConversion) return

    try {
      console.log('🎯 INICIANDO CONVERSÃO COM DEBUG DETALHADO')
      console.log('📊 Lead:', selectedLeadForConversion.full_name, '| Arcadas:', arcadas)

      // ===== STEP 1: VERIFICAÇÕES DE SEGURANÇA =====
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
        console.log('⚠️ LEAD JÁ CONVERTIDO - ABORTANDO')
        toast.error('Este lead já foi convertido!')
        setShowArcadasModal(false)
        setSelectedLeadForConversion(null)
        return
      }

      // ===== STEP 2: BUSCAR ESTABLISHMENT_CODE =====
      console.log('🔍 Buscando establishment_code para usuário:', selectedLeadForConversion.indicated_by)

      const { data: userEstablishment, error: userEstError } = await supabase
        .from('user_establishments')
        .select('establishment_code')
        .eq('user_id', selectedLeadForConversion.indicated_by)
        .eq('status', 'active')
        .single()

      if (userEstError) {
        console.error('❌ Erro ao buscar establishment do usuário:', userEstError)
      }

      const establishmentCode = userEstablishment?.establishment_code
      console.log('🏢 Establishment code encontrado:', establishmentCode)

      if (!establishmentCode) {
        console.error('❌ ESTABLISHMENT CODE NÃO ENCONTRADO!')
        toast.error('Erro: Código do estabelecimento não encontrado para este consultor')
        return
      }

      // ===== STEP 3: BUSCAR CONFIGURAÇÕES DO ESTABELECIMENTO =====
      console.log('⚙️ Buscando configurações para estabelecimento:', establishmentCode)

      const { data: settings, error: settingsError } = await supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      if (settingsError) {
        console.error('❌ Erro ao buscar configurações:', settingsError)
        console.log('⚠️ Usando configurações padrão')
      }

      // 🔥 CONFIGURAÇÕES CORRETAS
      const consultantValuePerArcada = settings?.consultant_value_per_arcada || 750
      const managerValuePerArcada = settings?.manager_value_per_arcada || 750
      const managerBonusActive = settings?.manager_bonus_active !== false

      console.log('💰 CONFIGURAÇÕES CARREGADAS:')
      console.log('   - Valor por arcada (consultor):', consultantValuePerArcada)
      console.log('   - Valor por arcada (gerente):', managerValuePerArcada)
      console.log('   - Bônus gerente ativo:', managerBonusActive)
      console.log('   - Arcadas selecionadas:', arcadas)

      // ===== STEP 4: VERIFICAR COMISSÕES EXISTENTES =====
      const { data: existingCommissions, error: commissionsCheckError } = await supabase
        .from('commissions')
        .select('id, amount, type, establishment_code, valor_por_arcada, arcadas_vendidas, user_id')
        .eq('lead_id', selectedLeadForConversion.id)

      if (commissionsCheckError) {
        console.error('❌ Erro ao verificar comissões existentes:', commissionsCheckError)
        throw commissionsCheckError
      }

      if (existingCommissions && existingCommissions.length > 0) {
        console.log('🔍 COMISSÕES EXISTENTES ENCONTRADAS:')
        console.table(existingCommissions)
        toast.error('Este lead já possui comissões registradas!')
        setShowArcadasModal(false)
        setSelectedLeadForConversion(null)
        return
      }

      // ===== STEP 5: ATUALIZAR O LEAD =====
      console.log('📝 Atualizando lead para convertido...')

      const { error: leadError } = await supabase
        .from('leads')
        .update({
          status: 'converted',
          arcadas_vendidas: arcadas,
          establishment_code: establishmentCode,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedLeadForConversion.id)

      if (leadError) {
        console.error('❌ Erro ao atualizar lead:', leadError)
        throw leadError
      }

      console.log('✅ LEAD ATUALIZADO COM SUCESSO')

      // ===== STEP 6: CALCULAR COMISSÃO DO CONSULTOR =====
      console.log('💰 CALCULANDO COMISSÃO DO CONSULTOR...')

      // Buscar arcadas já vendidas pelo consultor neste estabelecimento
      const { data: consultantLeads } = await supabase
        .from('leads')
        .select('arcadas_vendidas')
        .eq('indicated_by', selectedLeadForConversion.indicated_by)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')
        .neq('id', selectedLeadForConversion.id) // Excluir o lead atual

      const arcadasAnteriores = consultantLeads?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
      const arcadasTotais = arcadasAnteriores + arcadas

      // Valor base do consultor
      const valorBaseConsultor = arcadas * consultantValuePerArcada

      // Calcular bônus do consultor (se configurado)
      let valorBonusConsultor = 0
      let bonusConsultorGanhos = 0

      if (settings?.consultant_bonus_every_arcadas && settings?.consultant_bonus_value) {
        const bonusACada = settings.consultant_bonus_every_arcadas
        const valorBonusUnitario = settings.consultant_bonus_value

        const bonusAntes = Math.floor(arcadasAnteriores / bonusACada)
        const bonusDepois = Math.floor(arcadasTotais / bonusACada)

        bonusConsultorGanhos = bonusDepois - bonusAntes
        valorBonusConsultor = bonusConsultorGanhos * valorBonusUnitario
      }

      const valorTotalConsultor = valorBaseConsultor + valorBonusConsultor

      console.log('💰 COMISSÃO CONSULTOR:')
      console.log('   - Valor base:', valorBaseConsultor)
      console.log('   - Bônus ganhos:', bonusConsultorGanhos)
      console.log('   - Valor bônus:', valorBonusConsultor)
      console.log('   - Valor total:', valorTotalConsultor)

      // ===== STEP 7: CRIAR COMISSÃO DO CONSULTOR =====
      const { data: consultantCommissionData, error: consultantCommissionError } = await supabase
        .from('commissions')
        .insert({
          lead_id: selectedLeadForConversion.id,
          user_id: selectedLeadForConversion.indicated_by,
          clinic_id: selectedLeadForConversion.clinic_id,
          establishment_code: establishmentCode,
          amount: valorTotalConsultor,
          percentage: 100,
          type: 'consultant',
          status: 'pending',
          arcadas_vendidas: arcadas, // 🔥 CORRIGIDO: Campo arcadas
          valor_por_arcada: consultantValuePerArcada,
          bonus_conquistados: bonusConsultorGanhos,
          valor_bonus: valorBonusConsultor
        })
        .select('id, amount')
        .single()

      if (consultantCommissionError) {
        console.error('❌ ERRO AO CRIAR COMISSÃO DO CONSULTOR:', consultantCommissionError)
        throw consultantCommissionError
      }

      console.log('✅ COMISSÃO DO CONSULTOR CRIADA:', consultantCommissionData)

      // ===== STEP 8: VERIFICAR SE CONSULTOR TEM GERENTE =====
      console.log('👥 Verificando se consultor tem gerente...')

      const { data: hierarchy, error: hierarchyError } = await supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', selectedLeadForConversion.indicated_by)
        .single()

      if (hierarchyError && hierarchyError.code !== 'PGRST116') {
        console.warn('⚠️ Erro ao buscar hierarquia:', hierarchyError)
      }

      if (hierarchy?.manager_id) {
        console.log('👔 Gerente encontrado:', hierarchy.manager_id)

        // ===== STEP 9: CALCULAR COMISSÃO DO GERENTE =====
        console.log('💰 CALCULANDO COMISSÃO DO GERENTE...')

        // 🔥 COMISSÃO BASE INDEPENDENTE DO GERENTE
        const comissaoBaseGerente = arcadas * managerValuePerArcada

        console.log('💰 COMISSÃO BASE GERENTE:')
        console.log('   - Arcadas:', arcadas)
        console.log('   - Valor por arcada (gerente):', managerValuePerArcada)
        console.log('   - Comissão base total:', comissaoBaseGerente)

        let bonusGerente = 0

        // Calcular bônus apenas se estiver ativo
        if (managerBonusActive && settings) {
          console.log('🎯 Calculando bônus do gerente...')

          // Buscar equipe do gerente
          const { data: teamHierarchy } = await supabase
            .from('hierarchies')
            .select('consultant_id')
            .eq('manager_id', hierarchy.manager_id)

          const teamIds = teamHierarchy?.map(h => h.consultant_id) || []
          teamIds.push(hierarchy.manager_id) // Incluir o próprio gerente

          console.log('👥 IDs da equipe:', teamIds)

          // Buscar total de arcadas da equipe neste estabelecimento
          const { data: teamLeads } = await supabase
            .from('leads')
            .select('arcadas_vendidas')
            .in('indicated_by', teamIds)
            .eq('establishment_code', establishmentCode)
            .eq('status', 'converted')
            .neq('id', selectedLeadForConversion.id) // Excluir lead atual

          const totalArcadasEquipeAntes = teamLeads?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
          const totalArcadasEquipeDepois = totalArcadasEquipeAntes + arcadas

          console.log('📊 ARCADAS DA EQUIPE:')
          console.log('   - Antes:', totalArcadasEquipeAntes)
          console.log('   - Depois:', totalArcadasEquipeDepois)

          // Verificar marcos de bônus
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
              console.log(`🎉 Bônus ${marco.arcadas} arcadas: ${novosMarcos}x R$ ${marco.bonus} = R$ ${novosMarcos * marco.bonus}`)
            }
          }
        }

        const managerTotalAmount = comissaoBaseGerente + bonusGerente

        console.log('💰 RESUMO COMISSÃO GERENTE:')
        console.log('   - Comissão base:', comissaoBaseGerente)
        console.log('   - Bônus total:', bonusGerente)
        console.log('   - Valor total:', managerTotalAmount)

        // ===== STEP 10: CRIAR COMISSÃO DO GERENTE =====
        if (managerTotalAmount > 0) {
          const { data: managerCommissionData, error: managerCommissionError } = await supabase
            .from('commissions')
            .insert({
              lead_id: selectedLeadForConversion.id,
              user_id: hierarchy.manager_id,
              clinic_id: selectedLeadForConversion.clinic_id,
              establishment_code: establishmentCode,
              amount: managerTotalAmount,
              percentage: 100,
              type: 'manager',
              status: 'pending',
              arcadas_vendidas: arcadas, // 🔥 CORRIGIDO: Campo arcadas
              valor_por_arcada: managerValuePerArcada, // 🔥 CORRIGIDO: Valor correto do gerente
              bonus_conquistados: bonusGerente > 0 ? 1 : 0,
              valor_bonus: bonusGerente
            })
            .select('id, amount')
            .single()

          if (managerCommissionError) {
            console.error('❌ ERRO AO CRIAR COMISSÃO DO GERENTE:', managerCommissionError)
            throw managerCommissionError
          }

          console.log('✅ COMISSÃO DO GERENTE CRIADA:', managerCommissionData)
        } else {
          console.log('ℹ️ Gerente não receberá comissão (valor zero)')
        }
      } else {
        console.log('ℹ️ Consultor não possui gerente')
      }

      // ===== STEP 11: MENSAGENS DE SUCESSO =====
      console.log('🎉 CONVERSÃO CONCLUÍDA COM SUCESSO!')

      toast.success(`Lead convertido! ${arcadas} arcada${arcadas > 1 ? 's' : ''} vendida${arcadas > 1 ? 's' : ''}!`)

      if (bonusConsultorGanhos > 0) {
        toast.success(`🎉 Consultor ganhou ${bonusConsultorGanhos} bônus de R$ ${(valorBonusConsultor / bonusConsultorGanhos).toFixed(2)}!`, {
          duration: 6000
        })
      }

      setShowArcadasModal(false)
      setSelectedLeadForConversion(null)
      fetchLeads()

    } catch (error: any) {
      console.error('❌ ERRO DURANTE CONVERSÃO:', error)
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