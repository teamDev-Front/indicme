'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UsersIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  EyeIcon,
  XMarkIcon,
  TrophyIcon,
  ClockIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

interface ReportData {
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  totalCommissions: number
  paidCommissions: number
  pendingCommissions: number
  activeConsultants: number
  topPerformers: Array<{
    id: string
    name: string
    email: string
    phone?: string
    establishment_name?: string
    leads: number
    conversions: number
    commissions: number
    conversionRate: number
    totalArcadas: number
    lastLeadDate?: string
    avgTicket: number
  }>
  monthlyData: Array<{
    month: string
    leads: number
    conversions: number
    commissions: number
  }>
  leadsByStatus: Array<{
    status: string
    count: number
    percentage: number
  }>
  // 🔥 NOVO: Dados por estabelecimento
  establishmentData: Array<{
    name: string
    leads: number
    conversions: number
    revenue: number
    consultants: number
  }>
}

// 🔥 NOVA INTERFACE: Dados detalhados do performer
interface PerformerDetail {
  id: string
  name: string
  email: string
  phone?: string
  establishment_name?: string
  role: string
  status: string
  created_at: string
  leads: Array<{
    id: string
    full_name: string
    status: string
    created_at: string
    converted_at?: string
    arcadas_vendidas?: number
  }>
  commissions: Array<{
    id: string
    amount: number
    status: string
    created_at: string
    paid_at?: string
    type: string
  }>
  stats: {
    totalLeads: number
    convertedLeads: number
    conversionRate: number
    totalCommissions: number
    paidCommissions: number
    pendingCommissions: number
    totalArcadas: number
    avgTicket: number
    bestMonth: string
    performance: 'excellent' | 'good' | 'average' | 'poor'
  }
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  // 🔥 CORRIGIDO: Estados dos filtros funcionais
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [reportType, setReportType] = useState('overview')
  const [establishmentFilter, setEstablishmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('current_month')

  // 🔥 NOVO: Estados para modal de detalhes
  const [selectedPerformer, setSelectedPerformer] = useState<PerformerDetail | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const [establishments, setEstablishments] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (profile && (profile.role !== 'consultant')) {
      fetchReportData()
    }
  }, [profile, dateRange, establishmentFilter, statusFilter])

  // 🔥 FUNÇÃO CORRIGIDA: fetchReportData com filtros funcionais
  const fetchReportData = async () => {
    try {
      setLoading(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const startDate = new Date(dateRange.startDate)
      const endDate = new Date(dateRange.endDate)
      endDate.setHours(23, 59, 59, 999)

      console.log('🔍 Buscando dados de', startDate.toLocaleDateString(), 'até', endDate.toLocaleDateString())

      let leadsQuery = supabase
        .from('leads')
        .select(`
          *,
          users:indicated_by (
            id,
            full_name,
            email,
            phone,
            role
          )
        `)
        .eq('clinic_id', userClinic.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      let commissionsQuery = supabase
        .from('commissions')
        .select('*')
        .eq('clinic_id', userClinic.clinic_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      // 🔥 CORRIGIDO: Aplicar filtros funcionais
      if (statusFilter) {
        leadsQuery = leadsQuery.eq('status', statusFilter)
      }

      // Se for manager, filtrar por sua equipe
      if (profile?.role === 'manager') {
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id)

        leadsQuery = leadsQuery.in('indicated_by', consultantIds)
        commissionsQuery = commissionsQuery.in('user_id', consultantIds)
      }

      const [leadsResult, commissionsResult, consultantsResult] = await Promise.all([
        leadsQuery,
        commissionsQuery,
        supabase
          .from('users')
          .select(`
            id,
            full_name,
            email,
            phone,
            status,
            user_clinics!inner(clinic_id)
          `)
          .eq('user_clinics.clinic_id', userClinic.clinic_id)
          .eq('role', 'consultant')
          .eq('status', 'active')
      ])

      if (leadsResult.error) throw leadsResult.error
      if (commissionsResult.error) throw commissionsResult.error
      if (consultantsResult.error) throw consultantsResult.error

      const leads = leadsResult.data || []
      const commissions = commissionsResult.data || []
      const consultants = consultantsResult.data || []

      console.log('📊 Dados carregados:', {
        leads: leads.length,
        commissions: commissions.length,
        consultants: consultants.length
      })

      // Calcular métricas principais
      const totalLeads = leads.length
      const convertedLeads = leads.filter(l => l.status === 'converted').length
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount || 0), 0)
      const paidCommissions = commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0)
      const pendingCommissions = commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0)

      // 🔥 MELHORADO: Top performers com mais dados
      const performanceMap = new Map()

      leads.forEach(lead => {
        const consultantId = lead.indicated_by
        const consultant = lead.users

        if (!consultant) return

        if (!performanceMap.has(consultantId)) {
          performanceMap.set(consultantId, {
            id: consultantId,
            name: consultant.full_name,
            email: consultant.email,
            phone: consultant.phone || '',
            leads: 0,
            conversions: 0,
            commissions: 0,
            conversionRate: 0,
            totalArcadas: 0,
            avgTicket: 0,
            establishment_name: '',
            lastLeadDate: null
          })
        }

        const performance = performanceMap.get(consultantId)
        performance.leads += 1
        performance.lastLeadDate = lead.created_at

        if (lead.status === 'converted') {
          performance.conversions += 1
          performance.totalArcadas += (lead.arcadas_vendidas || 1)
        }
      })

      // Adicionar dados de comissões
      commissions.forEach(commission => {
        if (performanceMap.has(commission.user_id)) {
          const performance = performanceMap.get(commission.user_id)
          if (commission.status === 'paid') {
            performance.commissions += commission.amount || 0
          }
        }
      })

      // 🔥 NOVO: Buscar estabelecimentos para cada consultor
      const consultantIds = Array.from(performanceMap.keys())
      for (const consultantId of consultantIds) {
        const performance = performanceMap.get(consultantId)
        if (!performance) continue

        try {
          const { data: userEst } = await supabase
            .from('user_establishments')
            .select(`
              establishment_code,
              establishment_codes!user_establishments_establishment_code_fkey (
                name
              )
            `)
            .eq('user_id', consultantId)
            .eq('status', 'active')
            .single()

          if (userEst?.establishment_codes) {
            const estData = Array.isArray(userEst.establishment_codes)
              ? userEst.establishment_codes[0]
              : userEst.establishment_codes
            performance.establishment_name = estData?.name || 'N/A'
          }
        } catch (error) {
          performance.establishment_name = 'N/A'
        }
      }

      // Calcular conversion rate e ticket médio para cada consultor
      performanceMap.forEach(performance => {
        performance.conversionRate = performance.leads > 0
          ? (performance.conversions / performance.leads) * 100
          : 0
        performance.avgTicket = performance.conversions > 0
          ? performance.commissions / performance.conversions
          : 0
      })

      const topPerformers = Array.from(performanceMap.values())
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 10)

      // Dados mensais (últimos 6 meses)
      const monthlyData = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        const monthLeads = leads.filter(l => {
          const leadDate = new Date(l.created_at)
          return leadDate >= monthStart && leadDate <= monthEnd
        })

        const monthCommissions = commissions.filter(c => {
          const commissionDate = new Date(c.created_at)
          return commissionDate >= monthStart && commissionDate <= monthEnd && c.status === 'paid'
        })

        monthlyData.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          leads: monthLeads.length,
          conversions: monthLeads.filter(l => l.status === 'converted').length,
          commissions: monthCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)
        })
      }

      // Leads por status
      const statusCounts = {
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        scheduled: leads.filter(l => l.status === 'scheduled').length,
        converted: leads.filter(l => l.status === 'converted').length,
        lost: leads.filter(l => l.status === 'lost').length,
      }

      const leadsByStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: totalLeads > 0 ? (count / totalLeads) * 100 : 0
      }))

      // 🔥 NOVO: Dados por estabelecimento
      const establishmentMap = new Map()
      leads.forEach(lead => {
        const performance = performanceMap.get(lead.indicated_by)
        const estName = performance?.establishment_name || 'N/A'
        if (!establishmentMap.has(estName)) {
          establishmentMap.set(estName, {
            name: estName,
            leads: 0,
            conversions: 0,
            revenue: 0,
            consultants: new Set()
          })
        }
        const estData = establishmentMap.get(estName)
        estData.leads += 1
        estData.consultants.add(lead.indicated_by)
        if (lead.status === 'converted') {
          estData.conversions += 1
          estData.revenue += (lead.arcadas_vendidas || 1) * 750 // Estimativa
        }
      })

      const establishmentData = Array.from(establishmentMap.values()).map(est => ({
        ...est,
        consultants: est.consultants.size
      }))

      // Extrair estabelecimentos únicos para o filtro
      const uniqueEstablishments = topPerformers
        .map(p => p.establishment_name)
        .filter((name): name is string => Boolean(name) && name !== 'N/A')
        .filter((name, index, array) => array.indexOf(name) === index)
      setEstablishments(uniqueEstablishments)

      setData({
        totalLeads,
        convertedLeads,
        conversionRate,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        activeConsultants: consultants.length,
        topPerformers,
        monthlyData,
        leadsByStatus,
        establishmentData
      })

    } catch (error: any) {
      console.error('❌ Erro ao buscar dados do relatório:', error)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  // 🔥 NOVA FUNÇÃO: Buscar detalhes do performer
  const fetchPerformerDetails = async (performerId: string) => {
    try {
      setLoadingDetails(true)

      console.log('🔍 Buscando detalhes do consultor:', performerId)

      // Buscar dados básicos do consultor
      const { data: consultantData, error: consultantError } = await supabase
        .from('users')
        .select('*')
        .eq('id', performerId)
        .single()

      if (consultantError) throw consultantError

      // Buscar leads do consultor
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('indicated_by', performerId)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError

      // Buscar comissões do consultor
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', performerId)
        .order('created_at', { ascending: false })

      if (commissionsError) throw commissionsError

      // Buscar estabelecimento
      const { data: establishmentData } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            name
          )
        `)
        .eq('user_id', performerId)
        .eq('status', 'active')
        .single()

      let establishmentName = 'N/A'
      if (establishmentData?.establishment_codes) {
        const estData = Array.isArray(establishmentData.establishment_codes)
          ? establishmentData.establishment_codes[0]
          : establishmentData.establishment_codes
        establishmentName = estData?.name || 'N/A'
      }

      // Calcular estatísticas
      const totalLeads = leadsData?.length || 0
      const convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalCommissions = commissionsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      const totalArcadas = leadsData?.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
      const avgTicket = convertedLeads > 0 ? totalCommissions / convertedLeads : 0

      // Encontrar melhor mês
      const monthlyPerformance = new Map()
      leadsData?.forEach(lead => {
        const month = new Date(lead.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        if (!monthlyPerformance.has(month)) {
          monthlyPerformance.set(month, 0)
        }
        if (lead.status === 'converted') {
          monthlyPerformance.set(month, monthlyPerformance.get(month) + 1)
        }
      })

      const bestMonth = Array.from(monthlyPerformance.entries())
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'

      // Determinar performance
      let performance: 'excellent' | 'good' | 'average' | 'poor'
      if (conversionRate >= 40) performance = 'excellent'
      else if (conversionRate >= 25) performance = 'good'
      else if (conversionRate >= 15) performance = 'average'
      else performance = 'poor'

      const performerDetail: PerformerDetail = {
        id: consultantData.id,
        name: consultantData.full_name,
        email: consultantData.email,
        phone: consultantData.phone,
        establishment_name: establishmentName,
        role: consultantData.role,
        status: consultantData.status,
        created_at: consultantData.created_at,
        leads: leadsData || [],
        commissions: commissionsData || [],
        stats: {
          totalLeads,
          convertedLeads,
          conversionRate,
          totalCommissions,
          paidCommissions,
          pendingCommissions,
          totalArcadas,
          avgTicket,
          bestMonth,
          performance
        }
      }

      setSelectedPerformer(performerDetail)
      setIsDetailModalOpen(true)

    } catch (error: any) {
      console.error('❌ Erro ao buscar detalhes do performer:', error)
      toast.error('Erro ao carregar detalhes do consultor')
    } finally {
      setLoadingDetails(false)
    }
  }

  // 🔥 NOVA FUNÇÃO: Aplicar filtros rápidos
  const applyQuickFilter = (period: string) => {
    const today = new Date()
    let startDate: Date
    let endDate = new Date()

    switch (period) {
      case 'today':
        startDate = new Date()
        break
      case 'yesterday':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 1)
        endDate = new Date(today)
        endDate.setDate(today.getDate() - 1)
        break
      case 'this_week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay())
        break
      case 'last_week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay() - 7)
        endDate = new Date(today)
        endDate.setDate(today.getDate() - today.getDay() - 1)
        break
      case 'current_month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'last_month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'last_3_months':
        startDate = new Date(today.getFullYear(), today.getMonth() - 3, 1)
        break
      default:
        return
    }

    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    })
    setPeriodFilter(period)
  }

  const exportReport = () => {
    // TODO: Implementar exportação real
    toast.success('Relatório exportado com sucesso!')
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
      case 'converted': return 'bg-success-500'
      case 'lost': return 'bg-danger-500'
      case 'scheduled': return 'bg-primary-500'
      case 'contacted': return 'bg-warning-500'
      default: return 'bg-secondary-500'
    }
  }

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'excellent': return 'text-success-600 bg-success-100'
      case 'good': return 'text-blue-600 bg-blue-100'
      case 'average': return 'text-warning-600 bg-warning-100'
      case 'poor': return 'text-danger-600 bg-danger-100'
      default: return 'text-secondary-600 bg-secondary-100'
    }
  }

  const getPerformanceLabel = (performance: string) => {
    switch (performance) {
      case 'excellent': return '🏆 Excelente'
      case 'good': return '👍 Bom'
      case 'average': return '📊 Médio'
      case 'poor': return '📉 Baixo'
      default: return '❓ N/A'
    }
  }

  if (profile?.role === 'consultant') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ChartBarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
          <p className="text-secondary-500">Relatórios estão disponíveis apenas para managers e administradores.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Relatórios</h1>
          <p className="text-secondary-600">
            Análise detalhada da performance da {profile?.role === 'manager' ? 'sua equipe' : 'clínica'}
          </p>
        </div>

        <button onClick={exportReport} className="btn btn-primary">
          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
          Exportar Relatório
        </button>
      </div>

      {/* 🔥 FILTROS MELHORADOS E FUNCIONAIS */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Período rápido */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Período Rápido
              </label>
              <select
                className="input"
                value={periodFilter}
                onChange={(e) => applyQuickFilter(e.target.value)}
              >
                <option value="today">Hoje</option>
                <option value="yesterday">Ontem</option>
                <option value="this_week">Esta Semana</option>
                <option value="last_week">Semana Passada</option>
                <option value="current_month">Este Mês</option>
                <option value="last_month">Mês Passado</option>
                <option value="last_3_months">Últimos 3 Meses</option>
              </select>
            </div>

            {/* Data inicial */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Data Inicial
              </label>
              <input
                type="date"
                className="input"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            {/* Data final */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Data Final
              </label>
              <input
                type="date"
                className="input"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>

            {/* Estabelecimento */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Estabelecimento
              </label>
              <select
                className="input"
                value={establishmentFilter}
                onChange={(e) => setEstablishmentFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {establishments.map(est => (
                  <option key={est} value={est}>{est}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Status dos Leads
              </label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos os Status</option>
                <option value="new">Novo</option>
                <option value="contacted">Contatado</option>
                <option value="scheduled">Agendado</option>
                <option value="converted">Convertido</option>
                <option value="lost">Perdido</option>
              </select>
            </div>

            {/* Limpar filtros */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setEstablishmentFilter('')
                  setStatusFilter('')
                  applyQuickFilter('current_month')
                }}
                className="btn btn-secondary w-full"
              >
                <FunnelIcon className="h-4 w-4 mr-2" />
                Limpar
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                  <UsersIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500 truncate">
                    Total de Leads
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-secondary-900">
                      {data.totalLeads}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-success-600">
                      <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />
                      +12%
                    </div>
                  </dd>
                </dl>
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
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <ChartBarIcon className="w-5 h-5 text-success-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500 truncate">
                    Taxa de Conversão
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-secondary-900">
                      {data.conversionRate.toFixed(1)}%
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-success-600">
                      <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />
                      +5.2%
                    </div>
                  </dd>
                </dl>
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
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <CurrencyDollarIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500 truncate">
                    Comissões Pagas
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-secondary-900">
                      R$ {data.paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-success-600">
                      <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />
                      +18%
                    </div>
                  </dd>
                </dl>
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
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-warning-600" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-secondary-500 truncate">
                    Consultores Ativos
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-secondary-900">
                      {data.activeConsultants}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-secondary-500">
                      Ativos
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Tendência Mensal</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {data.monthlyData.map((month, index) => (
                <div key={month.month} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-secondary-900 w-16">
                      {month.month}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-secondary-500">Leads:</div>
                      <div className="text-sm font-medium text-primary-600">{month.leads}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-xs text-secondary-500">Conv:</div>
                      <div className="text-sm font-medium text-success-600">{month.conversions}</div>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-secondary-900">
                    R$ {month.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lead Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Distribuição por Status</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {data.leadsByStatus.map((item) => (
                <div key={item.status} className="flex items-center">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                    <div className="text-sm font-medium text-secondary-900 w-20">
                      {getStatusLabel(item.status)}
                    </div>
                    <div className="flex-1 bg-secondary-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getStatusColor(item.status)}`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="ml-4 text-sm font-medium text-secondary-900 w-12 text-right">
                    {item.count}
                  </div>
                  <div className="ml-2 text-xs text-secondary-500 w-12 text-right">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Top Performers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="card"
      >
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Top Performers</h3>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Consultor</th>
                  <th>Estabelecimento</th>
                  <th>Leads</th>
                  <th>Conversões</th>
                  <th>Taxa de Conversão</th>
                  <th>Comissões Recebidas</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {data.topPerformers.map((performer, index) => (
                  <tr key={performer.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {performer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-secondary-900">
                            {performer.name}
                          </div>
                          <div className="text-xs text-secondary-500">
                            #{index + 1} Posição
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="h-4 w-4 text-secondary-400 mr-1" />
                        <span className="text-sm text-secondary-900">
                          {performer.establishment_name || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-secondary-900">
                        {performer.leads}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-success-600">
                        {performer.conversions}
                      </div>
                      <div className="text-xs text-secondary-500">
                        {performer.totalArcadas} arcadas
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-secondary-900 mr-2">
                          {performer.conversionRate.toFixed(1)}%
                        </div>
                        {performer.conversionRate > data.conversionRate ? (
                          <ArrowTrendingUpIcon className="h-3 w-3 text-success-500" />
                        ) : (
                          <ArrowTrendingDownIcon className="h-3 w-3 text-danger-500" />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-secondary-900">
                        R$ {performer.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-secondary-500">
                        Ticket: R$ {performer.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-secondary-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-success-500"
                            style={{
                              width: `${Math.min((performer.conversions / Math.max(...data.topPerformers.map(p => p.conversions)) * 100), 100)}%`
                            }}
                          ></div>
                        </div>
                        {/* 🔥 BOTÃO FUNCIONAL CORRIGIDO */}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => fetchPerformerDetails(performer.id)}
                          disabled={loadingDetails}
                          title="Ver detalhes completos"
                        >
                          {loadingDetails ? (
                            <div className="loading-spinner w-3 h-3"></div>
                          ) : (
                            <EyeIcon className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.topPerformers.length === 0 && (
              <div className="text-center py-12">
                <ChartBarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  Nenhum dado de performance encontrado
                </h3>
                <p className="text-sm text-secondary-500">
                  Os dados aparecerão aqui quando houver atividade no período selecionado.
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card"
        >
          <div className="card-body text-center">
            <div className="w-12 h-12 bg-warning-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <CurrencyDollarIcon className="w-6 h-6 text-warning-600" />
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">
              Comissões Pendentes
            </h3>
            <p className="text-2xl font-bold text-warning-600 mb-2">
              R$ {data.pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-secondary-500">
              Aguardando pagamento
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="card"
        >
          <div className="card-body text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <ChartBarIcon className="w-6 h-6 text-primary-600" />
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">
              Média por Lead
            </h3>
            <p className="text-2xl font-bold text-primary-600 mb-2">
              R$ {data.totalLeads > 0 ? (data.totalCommissions / data.totalLeads).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
            </p>
            <p className="text-sm text-secondary-500">
              Valor médio por indicação
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="card"
        >
          <div className="card-body text-center">
            <div className="w-12 h-12 bg-success-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <ArrowTrendingUpIcon className="w-6 h-6 text-success-600" />
            </div>
            <h3 className="text-lg font-medium text-secondary-900 mb-2">
              Leads Convertidos
            </h3>
            <p className="text-2xl font-bold text-success-600 mb-2">
              {data.convertedLeads}
            </p>
            <p className="text-sm text-secondary-500">
              De {data.totalLeads} leads totais
            </p>
          </div>
        </motion.div>
      </div>

      {/* 🔥 NOVO: Modal de Detalhes do Performer */}
      <Transition appear show={isDetailModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDetailModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                      Detalhes do Consultor - {selectedPerformer?.name}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsDetailModalOpen(false)}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {selectedPerformer && (
                    <div className="p-6">
                      {/* Info Básica */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-primary-50 rounded-lg p-4">
                          <h4 className="font-medium text-primary-900 mb-3">Informações Pessoais</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center">
                              <EnvelopeIcon className="h-4 w-4 text-primary-600 mr-2" />
                              <span>{selectedPerformer.email}</span>
                            </div>
                            {selectedPerformer.phone && (
                              <div className="flex items-center">
                                <PhoneIcon className="h-4 w-4 text-primary-600 mr-2" />
                                <span>{selectedPerformer.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center">
                              <BuildingOfficeIcon className="h-4 w-4 text-primary-600 mr-2" />
                              <span>{selectedPerformer.establishment_name}</span>
                            </div>
                            <div className="flex items-center">
                              <CalendarIcon className="h-4 w-4 text-primary-600 mr-2" />
                              <span>Desde {new Date(selectedPerformer.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-success-50 rounded-lg p-4">
                          <h4 className="font-medium text-success-900 mb-3">Performance</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Taxa de Conversão:</span>
                              <span className="font-medium">{selectedPerformer.stats.conversionRate.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total de Arcadas:</span>
                              <span className="font-medium">{selectedPerformer.stats.totalArcadas}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Ticket Médio:</span>
                              <span className="font-medium">R$ {selectedPerformer.stats.avgTicket.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Melhor Mês:</span>
                              <span className="font-medium">{selectedPerformer.stats.bestMonth}</span>
                            </div>
                            <div className="mt-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColor(selectedPerformer.stats.performance)}`}>
                                {getPerformanceLabel(selectedPerformer.stats.performance)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-warning-50 rounded-lg p-4">
                          <h4 className="font-medium text-warning-900 mb-3">Financeiro</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Total Comissões:</span>
                              <span className="font-medium">R$ {selectedPerformer.stats.totalCommissions.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Pagas:</span>
                              <span className="font-medium text-success-600">R$ {selectedPerformer.stats.paidCommissions.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Pendentes:</span>
                              <span className="font-medium text-warning-600">R$ {selectedPerformer.stats.pendingCommissions.toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Leads Recentes */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-secondary-900 mb-4">Leads Recentes</h4>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {selectedPerformer.leads.slice(0, 10).map((lead) => (
                              <div key={lead.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                <div>
                                  <div className="font-medium text-secondary-900">{lead.full_name}</div>
                                  <div className="text-xs text-secondary-500">
                                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {lead.status === 'converted' && (
                                    <span className="text-xs bg-success-100 text-success-700 px-2 py-1 rounded">
                                      {lead.arcadas_vendidas || 1} arcada{(lead.arcadas_vendidas || 1) > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(lead.status)} text-white`}>
                                    {getStatusLabel(lead.status)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium text-secondary-900 mb-4">Comissões Recentes</h4>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {selectedPerformer.commissions.slice(0, 10).map((commission) => (
                              <div key={commission.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                <div>
                                  <div className="font-medium text-secondary-900">
                                    R$ {commission.amount.toLocaleString('pt-BR')}
                                  </div>
                                  <div className="text-xs text-secondary-500">
                                    {new Date(commission.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`text-xs px-2 py-1 rounded font-medium ${commission.status === 'paid' ? 'bg-success-100 text-success-700' :
                                      commission.status === 'pending' ? 'bg-warning-100 text-warning-700' :
                                        'bg-danger-100 text-danger-700'
                                    }`}>
                                    {commission.status === 'paid' ? 'Paga' :
                                      commission.status === 'pending' ? 'Pendente' : 'Cancelada'}
                                  </span>
                                  <span className={`text-xs px-2 py-1 rounded ${commission.type === 'consultant' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                    {commission.type === 'consultant' ? 'Consultor' : 'Manager'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}