// src/app/dashboard/page.tsx - VERSÃO CORRIGIDA BASEADA EM ESTABELECIMENTOS
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  UsersIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CheckCircleIcon,
  BuildingOfficeIcon,
  TrophyIcon,
  CalendarIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import toast from 'react-hot-toast'

// Interfaces
interface DashboardStats {
  totalLeads: number
  convertedLeads: number
  pendingLeads: number
  conversionRate: number
  totalArcadas: number
  totalRevenue: number
  totalCommissions: number
  paidCommissions: number
  pendingCommissions: number
  activeConsultants: number
  activeManagers: number
  thisMonthLeads: number
  thisMonthConversions: number
  establishmentCount: number
}

interface RecentActivity {
  id: string
  type: 'lead_created' | 'lead_converted' | 'commission_paid'
  title: string
  description: string
  date: string
  amount?: number
  user?: string
}

interface TopPerformer {
  id: string
  name: string
  role: 'consultant' | 'manager'
  establishment: string
  metrics: {
    leads: number
    conversions: number
    commissions: number
    conversionRate: number
  }
  avatar: string
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    convertedLeads: 0,
    pendingLeads: 0,
    conversionRate: 0,
    totalArcadas: 0,
    totalRevenue: 0,
    totalCommissions: 0,
    paidCommissions: 0,
    pendingCommissions: 0,
    activeConsultants: 0,
    activeManagers: 0,
    thisMonthLeads: 0,
    thisMonthConversions: 0,
    establishmentCount: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchDashboardData()
    }
  }, [profile])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Buscar dados baseado no role do usuário
      if (profile?.role === 'clinic_admin' || profile?.role === 'clinic_viewer') {
        await fetchClinicAdminData()
      } else if (profile?.role === 'manager') {
        await fetchManagerData()
      } else if (profile?.role === 'consultant') {
        await fetchConsultantData()
      }

    } catch (error: any) {
      console.error('❌ Erro ao buscar dados do dashboard:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }

  // CORREÇÃO: Função para admin baseada em estabelecimentos
  const fetchClinicAdminData = async () => {
    try {
      console.log('🔍 Buscando dados para clinic admin baseado em estabelecimentos...')

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) {
        console.warn('⚠️ Clínica não encontrada para o admin')
        return
      }

      // 1. Buscar todos os estabelecimentos ativos
      const { data: establishments } = await supabase
        .from('establishment_codes')
        .select('code, name')
        .eq('is_active', true)

      const establishmentCodes = establishments?.map(e => e.code) || []
      const establishmentCount = establishments?.length || 0

      // 2. Buscar todos os leads da clínica
      const { data: allLeads } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          arcadas_vendidas,
          created_at,
          establishment_code,
          indicated_by,
          users!leads_indicated_by_fkey (
            full_name,
            role
          )
        `)
        .eq('clinic_id', userClinic.clinic_id)
        .order('created_at', { ascending: false })

      console.log(`📊 Total de leads encontrados: ${allLeads?.length || 0}`)

      // 3. Calcular estatísticas dos leads
      const totalLeads = allLeads?.length || 0
      const convertedLeads = allLeads?.filter(l => l.status === 'converted').length || 0
      const pendingLeads = allLeads?.filter(l => ['new', 'contacted', 'scheduled'].includes(l.status)).length || 0
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      // 4. Calcular arcadas totais
      const totalArcadas = allLeads
        ?.filter(l => l.status === 'converted')
        ?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0

      // 5. NOVA LÓGICA: Calcular receita baseada nas configurações por estabelecimento
      let totalRevenue = 0
      const revenueByEstablishment = new Map<string, number>()

      // Para cada estabelecimento, buscar sua configuração de valor
      for (const establishment of establishments || []) {
        const { data: settings } = await supabase
          .from('establishment_commissions')
          .select('consultant_value_per_arcada')
          .eq('establishment_code', establishment.code)
          .single()

        const valorPorArcada = settings?.consultant_value_per_arcada || 750

        // Calcular arcadas convertidas neste estabelecimento
        const arcadasEstabelecimento = allLeads
          ?.filter(l => l.establishment_code === establishment.code && l.status === 'converted')
          ?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0

        const revenueEstabelecimento = arcadasEstabelecimento * valorPorArcada
        revenueByEstablishment.set(establishment.code, revenueEstabelecimento)
        totalRevenue += revenueEstabelecimento
      }

      console.log('💰 Receita por estabelecimento:', Object.fromEntries(revenueByEstablishment))
      console.log('💰 Receita total calculada:', totalRevenue)

      // 6. Buscar comissões da clínica
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, status, created_at, type, user_id')
        .eq('clinic_id', userClinic.clinic_id)

      const totalCommissions = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0
      const paidCommissions = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
      const pendingCommissions = commissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

      // 7. Contar usuários ativos
      const { data: users } = await supabase
        .from('users')
        .select(`
          id,
          role,
          status,
          user_clinics!inner(clinic_id)
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('status', 'active')

      const activeConsultants = users?.filter(u => u.role === 'consultant').length || 0
      const activeManagers = users?.filter(u => u.role === 'manager').length || 0

      // 8. Dados do mês atual
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const thisMonthLeads = allLeads?.filter(l =>
        new Date(l.created_at) >= startOfMonth
      ).length || 0

      const thisMonthConversions = allLeads?.filter(l =>
        l.status === 'converted' && new Date(l.created_at) >= startOfMonth
      ).length || 0

      // 9. Atualizar estado
      setStats({
        totalLeads,
        convertedLeads,
        pendingLeads,
        conversionRate,
        totalArcadas,
        totalRevenue,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        activeConsultants,
        activeManagers,
        thisMonthLeads,
        thisMonthConversions,
        establishmentCount,
      })

      // 10. Buscar atividades recentes
      await fetchRecentActivity(userClinic.clinic_id)

      // 11. Buscar top performers
      await fetchTopPerformers(userClinic.clinic_id)

      console.log('✅ Dados do dashboard carregados com sucesso')

    } catch (error) {
      console.error('❌ Erro ao buscar dados do clinic admin:', error)
      throw error
    }
  }

  // CORREÇÃO: Função para manager baseada em estabelecimentos
  const fetchManagerData = async () => {
    try {
      console.log('🔍 Buscando dados para manager baseado em estabelecimentos...')

      // Buscar clínica do manager
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      // Buscar estabelecimentos do manager
      const { data: managerEstablishments } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            code,
            name
          )
        `)
        .eq('user_id', profile?.id)
        .eq('status', 'active')

      const establishmentCodes = managerEstablishments?.map(me => me.establishment_code) || []

      // Buscar consultores da equipe
      const { data: teamConsultants } = await supabase
        .from('hierarchies')
        .select('consultant_id')
        .eq('manager_id', profile?.id)

      const consultantIds = teamConsultants?.map(h => h.consultant_id) || []
      if (profile) {
        consultantIds.push(profile.id)
      }

      // Buscar leads da equipe (por consultor + estabelecimento)
      let teamLeads: any[] = []

      if (consultantIds.length > 0) {
        const { data: leads } = await supabase
          .from('leads')
          .select(`
            id,
            status,
            arcadas_vendidas,
            created_at,
            establishment_code,
            indicated_by,
            users!leads_indicated_by_fkey (
              full_name,
              role
            )
          `)
          .in('indicated_by', consultantIds)
          .order('created_at', { ascending: false })

        teamLeads = leads || []
      }

      // Filtrar leads pelos estabelecimentos do manager
      const filteredLeads = teamLeads.filter(lead =>
        establishmentCodes.includes(lead.establishment_code)
      )

      console.log(`📊 Leads da equipe encontrados: ${filteredLeads.length}`)

      // Calcular estatísticas
      const totalLeads = filteredLeads.length
      const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length
      const pendingLeads = filteredLeads.filter(l => ['new', 'contacted', 'scheduled'].includes(l.status)).length
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalArcadas = filteredLeads
        .filter(l => l.status === 'converted')
        .reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)

      // CORREÇÃO: Calcular receita baseada nas configurações dos estabelecimentos
      let totalRevenue = 0

      for (const establishmentCode of establishmentCodes) {
        const { data: settings } = await supabase
          .from('establishment_commissions')
          .select('consultant_value_per_arcada')
          .eq('establishment_code', establishmentCode)
          .single()

        const valorPorArcada = settings?.consultant_value_per_arcada || 750

        const arcadasEstabelecimento = filteredLeads
          .filter(l => l.establishment_code === establishmentCode && l.status === 'converted')
          .reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)

        totalRevenue += arcadasEstabelecimento * valorPorArcada
      }

      // Buscar comissões da equipe
      const { data: teamCommissions } = await supabase
        .from('commissions')
        .select('amount, status, type')
        .in('user_id', consultantIds)

      const totalCommissions = teamCommissions?.reduce((sum, c) => sum + c.amount, 0) || 0
      const paidCommissions = teamCommissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
      const pendingCommissions = teamCommissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

      // Dados do mês atual
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const thisMonthLeads = filteredLeads.filter(l =>
        new Date(l.created_at) >= startOfMonth
      ).length

      const thisMonthConversions = filteredLeads.filter(l =>
        l.status === 'converted' && new Date(l.created_at) >= startOfMonth
      ).length

      setStats({
        totalLeads,
        convertedLeads,
        pendingLeads,
        conversionRate,
        totalArcadas,
        totalRevenue,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        activeConsultants: consultantIds.length - 1, // Excluir o próprio manager
        activeManagers: 1,
        thisMonthLeads,
        thisMonthConversions,
        establishmentCount: establishmentCodes.length,
      })

      await fetchRecentActivity(userClinic.clinic_id, consultantIds)

    } catch (error) {
      console.error('❌ Erro ao buscar dados do manager:', error)
      throw error
    }
  }

  // CORREÇÃO: Função para consultant baseada em estabelecimentos
  const fetchConsultantData = async () => {
    try {
      console.log('🔍 Buscando dados para consultant baseado em estabelecimentos...')

      // Buscar estabelecimentos do consultor
      const { data: consultantEstablishments } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            code,
            name
          )
        `)
        .eq('user_id', profile?.id)
        .eq('status', 'active')

      const establishmentCodes = consultantEstablishments?.map(ce => ce.establishment_code) || []

      // Buscar leads do consultor
      const { data: consultantLeads } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          arcadas_vendidas,
          created_at,
          establishment_code
        `)
        .eq('indicated_by', profile?.id)
        .order('created_at', { ascending: false })

      // Filtrar pelos estabelecimentos do consultor
      const filteredLeads = consultantLeads?.filter(lead =>
        establishmentCodes.includes(lead.establishment_code)
      ) || []

      console.log(`📊 Leads do consultor encontrados: ${filteredLeads.length}`)

      // Calcular estatísticas
      const totalLeads = filteredLeads.length
      const convertedLeads = filteredLeads.filter(l => l.status === 'converted').length
      const pendingLeads = filteredLeads.filter(l => ['new', 'contacted', 'scheduled'].includes(l.status)).length
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalArcadas = filteredLeads
        .filter(l => l.status === 'converted')
        .reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)

      // CORREÇÃO: Calcular receita baseada nas configurações dos estabelecimentos
      let totalRevenue = 0

      for (const establishmentCode of establishmentCodes) {
        const { data: settings } = await supabase
          .from('establishment_commissions')
          .select('consultant_value_per_arcada')
          .eq('establishment_code', establishmentCode)
          .single()

        const valorPorArcada = settings?.consultant_value_per_arcada || 750

        const arcadasEstabelecimento = filteredLeads
          .filter(l => l.establishment_code === establishmentCode && l.status === 'converted')
          .reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)

        totalRevenue += arcadasEstabelecimento * valorPorArcada
      }

      // Buscar comissões do consultor
      const { data: consultantCommissions } = await supabase
        .from('commissions')
        .select('amount, status, type')
        .eq('user_id', profile?.id)

      const totalCommissions = consultantCommissions?.reduce((sum, c) => sum + c.amount, 0) || 0
      const paidCommissions = consultantCommissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
      const pendingCommissions = consultantCommissions?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

      // Dados do mês atual
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const thisMonthLeads = filteredLeads.filter(l =>
        new Date(l.created_at) >= startOfMonth
      ).length

      const thisMonthConversions = filteredLeads.filter(l =>
        l.status === 'converted' && new Date(l.created_at) >= startOfMonth
      ).length

      setStats({
        totalLeads,
        convertedLeads,
        pendingLeads,
        conversionRate,
        totalArcadas,
        totalRevenue,
        totalCommissions,
        paidCommissions,
        pendingCommissions,
        activeConsultants: 1,
        activeManagers: 0,
        thisMonthLeads,
        thisMonthConversions,
        establishmentCount: establishmentCodes.length,
      })

    } catch (error) {
      console.error('❌ Erro ao buscar dados do consultant:', error)
      throw error
    }
  }

  const fetchRecentActivity = async (clinicId: string, userIds?: string[]) => {
    try {
      const activities: RecentActivity[] = []

      // Buscar leads recentes
      let leadsQuery = supabase
        .from('leads')
        .select(`
          id,
          full_name,
          status,
          created_at,
          users!leads_indicated_by_fkey (
            full_name
          )
        `)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (userIds) {
        leadsQuery = leadsQuery.in('indicated_by', userIds)
      }

      const { data: recentLeads } = await leadsQuery

      recentLeads?.forEach((lead: any) => {
        // CORREÇÃO: Tratar users como array ou objeto único
        const userData = Array.isArray(lead.users) ? lead.users[0] : lead.users
        const userName = userData?.full_name || 'Usuário não identificado'

        if (lead.status === 'converted') {
          activities.push({
            id: `lead-converted-${lead.id}`,
            type: 'lead_converted',
            title: 'Lead Convertido',
            description: `${lead.full_name} foi convertido por ${userName}`,
            date: lead.created_at,
            user: userName
          })
        } else {
          activities.push({
            id: `lead-created-${lead.id}`,
            type: 'lead_created',
            title: 'Novo Lead',
            description: `${lead.full_name} foi adicionado por ${userName}`,
            date: lead.created_at,
            user: userName
          })
        }
      })

      // Buscar comissões pagas recentes
      let commissionsQuery = supabase
        .from('commissions')
        .select(`
          id,
          amount,
          paid_at,
          users!commissions_user_id_fkey (
            full_name
          )
        `)
        .eq('status', 'paid')
        .not('paid_at', 'is', null)
        .order('paid_at', { ascending: false })
        .limit(5)

      if (userIds) {
        commissionsQuery = commissionsQuery.in('user_id', userIds)
      }

      const { data: paidCommissions } = await commissionsQuery

      paidCommissions?.forEach((commission: any) => {
        // CORREÇÃO: Tratar users como array ou objeto único
        const userData = Array.isArray(commission.users) ? commission.users[0] : commission.users
        const userName = userData?.full_name || 'Usuário não identificado'

        activities.push({
          id: `commission-paid-${commission.id}`,
          type: 'commission_paid',
          title: 'Comissão Paga',
          description: `R$ ${commission.amount.toFixed(2)} pago para ${userName}`,
          date: commission.paid_at,
          amount: commission.amount,
          user: userName
        })
      })

      // Ordenar por data
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

      setRecentActivity(activities.slice(0, 10))
    } catch (error) {
      console.error('❌ Erro ao buscar atividades recentes:', error)
    }
  }

  const fetchTopPerformers = async (clinicId: string) => {
    try {
      // Para simplificar, vamos focar nos consultores
      const { data: consultants } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          user_clinics!inner(clinic_id)
        `)
        .eq('user_clinics.clinic_id', clinicId)
        .eq('role', 'consultant')
        .eq('status', 'active')

      const performers = await Promise.all(
        (consultants || []).map(async (consultant: any) => {
          // Buscar leads do consultor
          const { data: leads } = await supabase
            .from('leads')
            .select('id, status, arcadas_vendidas')
            .eq('indicated_by', consultant.id)

          // Buscar comissões do consultor
          const { data: commissions } = await supabase
            .from('commissions')
            .select('amount, status')
            .eq('user_id', consultant.id)

          // Buscar estabelecimento do consultor
          const { data: establishment } = await supabase
            .from('user_establishments')
            .select(`
              establishment_codes!user_establishments_establishment_code_fkey (
                name
              )
            `)
            .eq('user_id', consultant.id)
            .eq('status', 'active')
            .limit(1)
            .single()

          const totalLeads = leads?.length || 0
          const conversions = leads?.filter(l => l.status === 'converted').length || 0
          const totalCommissions = commissions?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
          const conversionRate = totalLeads > 0 ? (conversions / totalLeads) * 100 : 0

          // CORREÇÃO: Tratar establishment_codes como array ou objeto único
          const establishmentData = Array.isArray(establishment?.establishment_codes)
            ? establishment.establishment_codes[0]
            : establishment?.establishment_codes
          const establishmentName = establishmentData?.name || 'N/A'

          return {
            id: consultant.id,
            name: consultant.full_name,
            role: 'consultant' as const,
            establishment: establishmentName,
            metrics: {
              leads: totalLeads,
              conversions,
              commissions: totalCommissions,
              conversionRate
            },
            avatar: consultant.full_name.charAt(0).toUpperCase()
          }
        })
      )

      // Ordenar por comissões
      performers.sort((a, b) => b.metrics.commissions - a.metrics.commissions)

      setTopPerformers(performers.slice(0, 5))
    } catch (error) {
      console.error('❌ Erro ao buscar top performers:', error)
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Bom dia'
    if (hour < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const getQuickActions = () => {
    switch (profile?.role) {
      case 'consultant':
        return [
          { label: 'Novo Lead', href: '/dashboard/leads/new', icon: UsersIcon },
          { label: 'Meus Leads', href: '/dashboard/leads', icon: ChartBarIcon },
          { label: 'Comissões', href: '/dashboard/commissions', icon: CurrencyDollarIcon },
        ]
      case 'manager':
        return [
          { label: 'Minha Equipe', href: '/dashboard/team', icon: UserGroupIcon },
          { label: 'Leads da Equipe', href: '/dashboard/leads', icon: UsersIcon },
          { label: 'Comissões', href: '/dashboard/commissions', icon: CurrencyDollarIcon },
        ]
      default:
        return [
          { label: 'Todos os Leads', href: '/dashboard/leads', icon: UsersIcon },
          { label: 'Consultores', href: '/dashboard/consultants', icon: UserGroupIcon },
          { label: 'Estabelecimentos', href: '/dashboard/establishments', icon: BuildingOfficeIcon },
          { label: 'Relatórios', href: '/dashboard/reports', icon: ChartBarIcon },
        ]
    }
  }

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
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">
          {getGreeting()}, {profile?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-secondary-600">
          Aqui está um resumo das suas atividades e performance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Leads */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <UsersIcon className="w-5 h-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-secondary-500">Conversões</p>
                  <span className="text-xs text-secondary-400">
                    {stats.thisMonthConversions} este mês
                  </span>
                </div>
                <p className="text-2xl font-bold text-secondary-900">{stats.convertedLeads}</p>
                <div className="flex items-center mt-1">
                  <span className="text-sm text-success-600 font-medium">
                    {stats.conversionRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-secondary-500 ml-1">taxa de conversão</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Receita Total */}
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
                  <TrophyIcon className="w-5 h-5 text-warning-600" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-secondary-500">Receita Total</p>
                  <span className="text-xs text-secondary-400">
                    {stats.totalArcadas} arcadas
                  </span>
                </div>
                <p className="text-2xl font-bold text-secondary-900">
                  R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
                <div className="text-xs text-secondary-500">
                  Baseado nas configurações por estabelecimento
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Comissões */}
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
                  <CurrencyDollarIcon className="w-5 h-5 text-success-600" />
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-secondary-500">Comissões</p>
                  <span className="text-xs text-secondary-400">
                    R$ {stats.pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} pendente
                  </span>
                </div>
                <p className="text-2xl font-bold text-secondary-900">
                  R$ {stats.paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
                <div className="text-xs text-secondary-500">
                  R$ {stats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })} total
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Ações Rápidas</h3>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {getQuickActions().map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center p-3 rounded-lg border border-secondary-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                >
                  <action.icon className="h-5 w-5 text-secondary-400 group-hover:text-primary-600 mr-3" />
                  <span className="text-sm font-medium text-secondary-700 group-hover:text-primary-700">
                    {action.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Atividade Recente</h3>
          </div>
          <div className="card-body">
            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === 'lead_converted' && (
                        <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                          <CheckCircleIcon className="w-4 h-4 text-success-600" />
                        </div>
                      )}
                      {activity.type === 'lead_created' && (
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <UsersIcon className="w-4 h-4 text-primary-600" />
                        </div>
                      )}
                      {activity.type === 'commission_paid' && (
                        <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                          <CurrencyDollarIcon className="w-4 h-4 text-warning-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-secondary-900">
                          {activity.title}
                        </p>
                        <p className="text-xs text-secondary-500">
                          {new Date(activity.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <p className="text-sm text-secondary-600">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <CalendarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                <p className="text-sm text-secondary-500">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Top Performers & Additional Stats */}
      {(profile?.role === 'clinic_admin' || profile?.role === 'manager') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Top Performers</h3>
            </div>
            <div className="card-body">
              {topPerformers.length > 0 ? (
                <div className="space-y-4">
                  {topPerformers.map((performer, index) => (
                    <div key={performer.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-secondary-400">
                            #{index + 1}
                          </span>
                          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {performer.avatar}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-secondary-900">
                            {performer.name}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {performer.establishment}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-success-600">
                          R$ {performer.metrics.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-secondary-500">
                          {performer.metrics.conversions} conversões ({performer.metrics.conversionRate.toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <StarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                  <p className="text-sm text-secondary-500">Nenhum performer encontrado</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Additional Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="card"
          >
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Estatísticas Gerais</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <UserGroupIcon className="h-5 w-5 text-primary-500" />
                    <span className="text-sm font-medium text-secondary-700">
                      Consultores Ativos
                    </span>
                  </div>
                  <span className="text-sm font-bold text-secondary-900">
                    {stats.activeConsultants}
                  </span>
                </div>

                {profile?.role === 'clinic_admin' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <UsersIcon className="h-5 w-5 text-success-500" />
                      <span className="text-sm font-medium text-secondary-700">
                        Gerentes Ativos
                      </span>
                    </div>
                    <span className="text-sm font-bold text-secondary-900">
                      {stats.activeManagers}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <BuildingOfficeIcon className="h-5 w-5 text-warning-500" />
                    <span className="text-sm font-medium text-secondary-700">
                      Estabelecimentos
                    </span>
                  </div>
                  <span className="text-sm font-bold text-secondary-900">
                    {stats.establishmentCount}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <ClockIcon className="h-5 w-5 text-secondary-500" />
                    <span className="text-sm font-medium text-secondary-700">
                      Leads Pendentes
                    </span>
                  </div>
                  <span className="text-sm font-bold text-secondary-900">
                    {stats.pendingLeads}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <TrophyIcon className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium text-secondary-700">
                      Total Arcadas
                    </span>
                  </div>
                  <span className="text-sm font-bold text-secondary-900">
                    {stats.totalArcadas}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Debug Info (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="card bg-blue-50 border-blue-200"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-blue-900">Debug Info</h3>
          </div>
          <div className="card-body">
            <div className="text-xs text-blue-700">
              <div><strong>User Role:</strong> {profile?.role}</div>
              <div><strong>User ID:</strong> {profile?.id}</div>
              <div><strong>Establishment Count:</strong> {stats.establishmentCount}</div>
              <div><strong>Total Revenue Calculation:</strong> Based on establishment-specific commission settings</div>
              <div><strong>Stats:</strong> {JSON.stringify(stats, null, 2)}</div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}