'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  UsersIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusIcon,
  EyeIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BellIcon,
  CalendarIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface DashboardStats {
  totalLeads: number
  convertedLeads: number
  pendingCommissions: number
  paidCommissions: number
  totalCommissions: number
  recentLeads: any[]
  conversionRate: number
  // Específicos por role
  teamSize?: number // Para managers
  totalUsers?: number // Para admins
  activeUsers?: number // Para admins
  totalClinics?: number // Para super admins (futuro)
  monthlyGrowth?: number
  pendingTasks?: number
}

interface QuickAction {
  title: string
  description: string
  icon: any
  href: string
  color: 'primary' | 'success' | 'warning' | 'danger' | 'secondary'
  badge?: string
}

interface RecentActivity {
  id: string
  type: 'lead_created' | 'lead_converted' | 'commission_paid' | 'user_joined' | 'team_update'
  title: string
  description: string
  time: string
  icon: any
  color: string
}

export default function ImprovedDashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    convertedLeads: 0,
    pendingCommissions: 0,
    paidCommissions: 0,
    totalCommissions: 0,
    recentLeads: [],
    conversionRate: 0,
    monthlyGrowth: 0,
    pendingTasks: 0,
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [quickActions, setQuickActions] = useState<QuickAction[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchDashboardData()
      setQuickActionsBasedOnRole()
    }
  }, [profile])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      if (!profile) return

      let stats: DashboardStats = {
        totalLeads: 0,
        convertedLeads: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        totalCommissions: 0,
        recentLeads: [],
        conversionRate: 0,
        monthlyGrowth: 0,
        pendingTasks: 0,
      }

      // Buscar dados baseados no role
      if (profile.role === 'consultant') {
        await fetchConsultantData(stats)
      } else if (profile.role === 'manager') {
        await fetchManagerData(stats)
      } else if (profile.role === 'clinic_admin' || profile.role === 'clinic_viewer') {
        await fetchClinicAdminData(stats)
      }

      // Buscar atividades recentes
      await fetchRecentActivities()

      setStats(stats)
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchConsultantData = async (stats: DashboardStats) => {
    // Leads do consultor
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .eq('indicated_by', profile!.id)
      .order('created_at', { ascending: false })

    // Comissões do consultor
    const { data: commissionsData } = await supabase
      .from('commissions')
      .select('*')
      .eq('user_id', profile!.id)

    stats.totalLeads = leadsData?.length || 0
    stats.convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
    stats.conversionRate = stats.totalLeads > 0 ? (stats.convertedLeads / stats.totalLeads) * 100 : 0

    stats.totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
    stats.paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
    stats.pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

    stats.recentLeads = leadsData?.slice(0, 5) || []

    // Calcular crescimento mensal
    const thisMonth = new Date()
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1)
    const thisMonthLeads = leadsData?.filter(l => new Date(l.created_at) >= lastMonth).length || 0
    const previousMonthLeads = leadsData?.filter(l => {
      const date = new Date(l.created_at)
      return date >= new Date(lastMonth.getFullYear(), lastMonth.getMonth() - 1, 1) && date < lastMonth
    }).length || 0

    stats.monthlyGrowth = previousMonthLeads > 0 ? ((thisMonthLeads - previousMonthLeads) / previousMonthLeads) * 100 : 0
    stats.pendingTasks = leadsData?.filter(l => l.status === 'new').length || 0
  }

  const fetchManagerData = async (stats: DashboardStats) => {
    // Buscar equipe do manager
    const { data: teamData } = await supabase
      .from('hierarchies')
      .select('consultant_id')
      .eq('manager_id', profile!.id)

    const consultantIds = teamData?.map(h => h.consultant_id) || []
    consultantIds.push(profile!.id) // Incluir leads próprios

    stats.teamSize = teamData?.length || 0

    if (consultantIds.length > 0) {
      // Leads da equipe
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .in('indicated_by', consultantIds)
        .order('created_at', { ascending: false })

      // Comissões da equipe
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('*')
        .in('user_id', consultantIds)

      stats.totalLeads = leadsData?.length || 0
      stats.convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
      stats.conversionRate = stats.totalLeads > 0 ? (stats.convertedLeads / stats.totalLeads) * 100 : 0

      stats.totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
      stats.paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
      stats.pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

      stats.recentLeads = leadsData?.slice(0, 5) || []
      stats.pendingTasks = leadsData?.filter(l => ['new', 'contacted'].includes(l.status)).length || 0
    }
  }

  const fetchClinicAdminData = async (stats: DashboardStats) => {
    // Buscar clínica do usuário
    const { data: userClinic } = await supabase
      .from('user_clinics')
      .select('clinic_id')
      .eq('user_id', profile!.id)
      .single()

    if (!userClinic) return

    // Todos os usuários da clínica
    const { data: usersData } = await supabase
      .from('users')
      .select(`
        *,
        user_clinics!inner(clinic_id)
      `)
      .eq('user_clinics.clinic_id', userClinic.clinic_id)

    // Todos os leads da clínica
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .eq('clinic_id', userClinic.clinic_id)
      .order('created_at', { ascending: false })

    // Todas as comissões da clínica
    const { data: commissionsData } = await supabase
      .from('commissions')
      .select('*')
      .eq('clinic_id', userClinic.clinic_id)

    stats.totalUsers = usersData?.length || 0
    stats.activeUsers = usersData?.filter(u => u.status === 'active').length || 0

    stats.totalLeads = leadsData?.length || 0
    stats.convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
    stats.conversionRate = stats.totalLeads > 0 ? (stats.convertedLeads / stats.totalLeads) * 100 : 0

    stats.totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
    stats.paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
    stats.pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

    stats.recentLeads = leadsData?.slice(0, 5) || []
    stats.pendingTasks = commissionsData?.filter(c => c.status === 'pending').length || 0
  }

  const fetchRecentActivities = async () => {
    const activities: RecentActivity[] = []

    // Buscar atividades baseadas no role
    if (profile?.role === 'consultant') {
      // Últimas atividades do consultor
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('indicated_by', profile.id)
        .order('created_at', { ascending: false })
        .limit(3)

      recentLeads?.forEach(lead => {
        activities.push({
          id: lead.id,
          type: 'lead_created',
          title: 'Novo lead criado',
          description: `${lead.full_name} foi adicionado como lead`,
          time: lead.created_at,
          icon: UsersIcon,
          color: 'text-primary-600'
        })
      })
    } else if (profile?.role === 'manager' || profile?.role === 'clinic_admin') {
      // Atividades gerais da equipe/clínica
      const { data: recentLeads } = await supabase
        .from('leads')
        .select(`
          *,
          users:indicated_by (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      recentLeads?.forEach(lead => {
        activities.push({
          id: lead.id,
          type: lead.status === 'converted' ? 'lead_converted' : 'lead_created',
          title: lead.status === 'converted' ? 'Lead convertido' : 'Novo lead',
          description: `${lead.full_name} por ${lead.users?.full_name || 'Usuário'}`,
          time: lead.created_at,
          icon: lead.status === 'converted' ? CheckCircleIcon : UsersIcon,
          color: lead.status === 'converted' ? 'text-success-600' : 'text-primary-600'
        })
      })
    }

    setRecentActivities(activities.slice(0, 5))
  }

  const setQuickActionsBasedOnRole = () => {
    let actions: QuickAction[] = []

    if (profile?.role === 'consultant') {
      actions = [
        {
          title: 'Novo Lead',
          description: 'Cadastrar uma nova indicação',
          icon: PlusIcon,
          href: '/dashboard/leads/new',
          color: 'primary',
        },
        {
          title: 'Meus Leads',
          description: 'Ver todas as suas indicações',
          icon: UsersIcon,
          href: '/dashboard/leads',
          color: 'secondary',
          badge: stats.totalLeads.toString(),
        },
        {
          title: 'Minhas Comissões',
          description: 'Acompanhar seus ganhos',
          icon: CurrencyDollarIcon,
          href: '/dashboard/commissions',
          color: 'success',
          badge: `R$ ${stats.paidCommissions.toFixed(0)}`,
        },
      ]
    } else if (profile?.role === 'manager') {
      actions = [
        {
          title: 'Minha Equipe',
          description: 'Gerenciar consultores',
          icon: UserGroupIcon,
          href: '/dashboard/team',
          color: 'primary',
          badge: stats.teamSize?.toString(),
        },
        {
          title: 'Leads da Equipe',
          description: 'Ver leads da equipe',
          icon: UsersIcon,
          href: '/dashboard/leads',
          color: 'secondary',
          badge: stats.totalLeads.toString(),
        },
        {
          title: 'Relatórios',
          description: 'Análise de performance',
          icon: ChartBarIcon,
          href: '/dashboard/reports',
          color: 'warning',
        },
        {
          title: 'Comissões',
          description: 'Gerenciar pagamentos',
          icon: CurrencyDollarIcon,
          href: '/dashboard/commissions',
          color: 'success',
        },
      ]
    } else if (profile?.role === 'clinic_admin') {
      actions = [
        {
          title: 'Gerenciar Usuários',
          description: 'Consultores e gerentes',
          icon: UserGroupIcon,
          href: '/dashboard/consultants',
          color: 'primary',
          badge: stats.totalUsers?.toString(),
        },
        {
          title: 'Todos os Leads',
          description: 'Visão geral dos leads',
          icon: UsersIcon,
          href: '/dashboard/leads',
          color: 'secondary',
          badge: stats.totalLeads.toString(),
        },
        {
          title: 'Relatórios Gerais',
          description: 'Dashboard executivo',
          icon: ChartBarIcon,
          href: '/dashboard/reports',
          color: 'warning',
        },
        {
          title: 'Configurações',
          description: 'Configurar sistema',
          icon: BuildingOfficeIcon,
          href: '/dashboard/settings',
          color: 'danger',
        },
      ]
    } else if (profile?.role === 'clinic_viewer') {
      actions = [
        {
          title: 'Ver Leads',
          description: 'Visualizar indicações',
          icon: EyeIcon,
          href: '/dashboard/leads',
          color: 'secondary',
          badge: stats.totalLeads.toString(),
        },
        {
          title: 'Ver Relatórios',
          description: 'Acompanhar métricas',
          icon: ChartBarIcon,
          href: '/dashboard/reports',
          color: 'warning',
        },
      ]
    }

    setQuickActions(actions)
  }

  const getMainStatsCards = () => {
    const baseCards = [
      {
        name: profile?.role === 'consultant' ? 'Meus Leads' : 'Total de Leads',
        value: stats.totalLeads,
        icon: UsersIcon,
        color: 'primary',
        change: `${Number(stats.monthlyGrowth?.toFixed(1)) > 0 ? '+' : ''}${stats.monthlyGrowth?.toFixed(1)}%`,
        changeType: Number(stats.monthlyGrowth?.toFixed(1)) >= 0 ? 'increase' : 'decrease',
        changeLabel: 'vs mês anterior'
      },
      {
        name: 'Taxa de Conversão',
        value: `${stats.conversionRate.toFixed(1)}%`,
        icon: ChartBarIcon,
        color: 'success',
        change: stats.convertedLeads > 0 ? `${stats.convertedLeads} conversões` : 'Sem conversões',
        changeType: 'neutral',
        changeLabel: 'total'
      },
      {
        name: profile?.role === 'consultant' ? 'Comissões Pendentes' : 'Comissões a Pagar',
        value: `R$ ${stats.pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        icon: ClockIcon,
        color: 'warning',
        change: `${stats.pendingTasks} ${profile?.role === 'consultant' ? 'aguardando' : 'pendentes'}`,
        changeType: 'neutral',
        changeLabel: ''
      },
      {
        name: profile?.role === 'consultant' ? 'Total Recebido' : 'Total Pago',
        value: `R$ ${stats.paidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
        icon: CurrencyDollarIcon,
        color: 'success',
        change: '+18%',
        changeType: 'increase',
        changeLabel: 'vs mês anterior'
      }
    ]

    // Adicionar cards específicos por role
    if (profile?.role === 'manager') {
      baseCards.push({
        name: 'Tamanho da Equipe',
        value: stats.teamSize || 0,
        icon: UserGroupIcon,
        color: 'primary',
        change: 'consultores',
        changeType: 'neutral',
        changeLabel: 'ativos'
      })
    } else if (profile?.role === 'clinic_admin') {
      baseCards.push({
        name: 'Usuários Ativos',
        value: stats.activeUsers || 0,
        icon: UserGroupIcon,
        color: 'primary',
        change: `${stats.totalUsers} total`,
        changeType: 'neutral',
        changeLabel: 'usuários'
      })
    }

    return baseCards
  }

  const getRoleSpecificInsights = () => {
    if (profile?.role === 'consultant') {
      return (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-start">
            <InformationCircleIcon className="h-5 w-5 text-primary-500 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-primary-900 mb-1">
                Dica para Aumentar Conversões
              </h4>
              <p className="text-sm text-primary-700">
                {stats.conversionRate < 20
                  ? 'Tente fazer follow-up mais frequente com seus leads. Um contato em 24h aumenta a conversão em 60%.'
                  : stats.conversionRate < 40
                    ? 'Sua taxa está boa! Continue investindo no relacionamento pós-contato inicial.'
                    : 'Excelente performance! Considere compartilhar suas técnicas com a equipe.'
                }
              </p>
            </div>
          </div>
        </div>
      )
    } else if (profile?.role === 'manager') {
      return (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-warning-500 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-warning-900 mb-1">
                Atenção da Gestão
              </h4>
              <p className="text-sm text-warning-700">
                {(stats.pendingTasks ?? 0) > 10
                  ? `Há ${stats.pendingTasks} leads pendentes de follow-up. Considere redistribuir ou oferecer suporte à equipe.`
                  :  stats.teamSize === 0
                ? 'Sua equipe está vazia. Adicione consultores para começar a gerar resultados.'
                : `Equipe performando bem com ${stats.teamSize} consultores ativos.`
                }
              </p>
            </div>
          </div>
        </div>
      )
    } else {
      return (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircleIcon className="h-5 w-5 text-success-500 mr-3 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-success-900 mb-1">
                Status da Clínica
              </h4>
              <p className="text-sm text-success-700">
                Sistema funcionando normalmente com {stats.activeUsers} usuários ativos gerando {stats.totalLeads} leads.
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Agora mesmo'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`
    return `${Math.floor(diffInSeconds / 86400)}d atrás`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  const mainStats = getMainStatsCards()

  return (
    <div className="space-y-6">
      {/* Personalized Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            {profile?.role === 'consultant' ? `Olá, ${profile.full_name.split(' ')[0]}!` :
              profile?.role === 'manager' ? `Dashboard da Equipe` :
                `Painel Administrativo`
            }
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'consultant' ? 'Aqui está o resumo das suas indicações e ganhos.' :
              profile?.role === 'manager' ? 'Acompanhe a performance da sua equipe em tempo real.' :
                'Visão geral completa da clínica e operações.'
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <BellIcon className="h-5 w-5 text-secondary-400" />
          <span className="text-sm text-secondary-500">
            Última atualização: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Role-specific Insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {getRoleSpecificInsights()}
      </motion.div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
        {mainStats.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="card"
          >
            <div className="card-body">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 bg-${item.color}-100 rounded-lg flex items-center justify-center`}>
                    <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-secondary-500 truncate">
                      {item.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-secondary-900">
                        {item.value}
                      </div>
                      {item.change && (
                        <div className={`ml-2 flex items-baseline text-sm font-semibold ${item.changeType === 'increase'
                            ? 'text-success-600'
                            : item.changeType === 'decrease'
                              ? 'text-danger-600'
                              : 'text-secondary-500'
                          }`}>
                          {item.changeType === 'increase' && <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />}
                          {item.changeType === 'decrease' && <ArrowTrendingDownIcon className="w-3 h-3 mr-1" />}
                          {item.change}
                        </div>
                      )}
                    </dd>
                    {item.changeLabel && (
                      <dd className="text-xs text-secondary-500">{item.changeLabel}</dd>
                    )}
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="lg:col-span-2 card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Ações Rápidas</h3>
            <p className="text-sm text-secondary-500">Acesse rapidamente as principais funcionalidades</p>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action, index) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className={`group relative block p-4 border-2 border-${action.color}-200 rounded-lg hover:border-${action.color}-300 transition-all duration-200 hover:shadow-md`}
                >
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-10 h-10 bg-${action.color}-100 rounded-lg flex items-center justify-center group-hover:bg-${action.color}-200 transition-colors`}>
                      <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-secondary-900 group-hover:text-secondary-700">
                          {action.title}
                        </h4>
                        {action.badge && (
                          <span className={`badge badge-${action.color} text-xs`}>
                            {action.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-secondary-500 mt-1">
                        {action.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Atividade Recente</h3>
          </div>
          <div className="card-body">
            {recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
                        <activity.icon className={`w-4 h-4 ${activity.color}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary-900">
                        {activity.title}
                      </p>
                      <p className="text-sm text-secondary-500 truncate">
                        {activity.description}
                      </p>
                      <p className="text-xs text-secondary-400 mt-1">
                        {formatTimeAgo(activity.time)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <ClockIcon className="mx-auto h-8 w-8 text-secondary-400 mb-2" />
                <p className="text-sm text-secondary-500">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Recent Leads Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
        className="card"
      >
        <div className="card-header flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-secondary-900">
              {profile?.role === 'consultant' ? 'Seus Leads Recentes' : 'Leads Recentes'}
            </h3>
            <p className="text-sm text-secondary-500">
              Últimas indicações {profile?.role === 'consultant' ? 'suas' : 'da equipe'}
            </p>
          </div>
          <Link
            href="/dashboard/leads"
            className="btn btn-ghost btn-sm"
          >
            Ver todos
          </Link>
        </div>
        <div className="card-body">
          {stats.recentLeads.length > 0 ? (
            <div className="space-y-4">
              {stats.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-3 border-b border-secondary-100 last:border-b-0">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${lead.status === 'converted' ? 'bg-success-500' :
                          lead.status === 'lost' ? 'bg-danger-500' :
                            lead.status === 'contacted' ? 'bg-warning-500' :
                              'bg-primary-500'
                        }`}></div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {lead.full_name}
                      </p>
                      <p className="text-sm text-secondary-500 truncate">
                        {lead.phone} • {lead.email || 'Sem email'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`badge ${lead.status === 'converted' ? 'badge-success' :
                        lead.status === 'lost' ? 'badge-danger' :
                          lead.status === 'contacted' ? 'badge-warning' :
                            lead.status === 'scheduled' ? 'badge-primary' :
                              'badge-secondary'
                      }`}>
                      {lead.status === 'new' ? 'Novo' :
                        lead.status === 'contacted' ? 'Contatado' :
                          lead.status === 'scheduled' ? 'Agendado' :
                            lead.status === 'converted' ? 'Convertido' :
                              'Perdido'}
                    </span>
                    <span className="text-xs text-secondary-400">
                      {formatTimeAgo(lead.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto h-12 w-12 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">
                {profile?.role === 'consultant' ? 'Nenhum lead ainda' : 'Nenhum lead encontrado'}
              </h3>
              <p className="mt-1 text-sm text-secondary-500">
                {profile?.role === 'consultant'
                  ? 'Comece criando seu primeiro lead.'
                  : 'Os leads aparecerão aqui quando forem criados.'
                }
              </p>
              {profile?.role === 'consultant' && (
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
      </motion.div>

      {/* Role-specific Bottom Section */}
      {profile?.role === 'consultant' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Performance Tips */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Dicas de Performance</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-900">Follow-up em 24h</p>
                  <p className="text-xs text-secondary-500">Aumente suas conversões em até 60%</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-success-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-900">Qualifique os leads</p>
                  <p className="text-xs text-secondary-500">Foque nos leads mais promissores</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-warning-500 rounded-full mt-2"></div>
                <div>
                  <p className="text-sm font-medium text-secondary-900">Use múltiplos canais</p>
                  <p className="text-xs text-secondary-500">WhatsApp, telefone e email</p>
                </div>
              </div>
            </div>
          </div>

          {/* Goals Widget */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-secondary-900">Meta do Mês</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Leads criados</span>
                    <span className="font-medium">{stats.totalLeads}/30</span>
                  </div>
                  <div className="mt-2 bg-secondary-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.totalLeads / 30) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-secondary-600">Conversões</span>
                    <span className="font-medium">{stats.convertedLeads}/5</span>
                  </div>
                  <div className="mt-2 bg-secondary-200 rounded-full h-2">
                    <div
                      className="bg-success-600 h-2 rounded-full"
                      style={{ width: `${Math.min((stats.convertedLeads / 5) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {profile?.role === 'manager' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="card"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900">Resumo da Equipe</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{stats.teamSize || 0}</div>
                <div className="text-sm text-secondary-500">Consultores Ativos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">{stats.conversionRate.toFixed(1)}%</div>
                <div className="text-sm text-secondary-500">Taxa da Equipe</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning-600">{stats.pendingTasks}</div>
                <div className="text-sm text-secondary-500">Leads Pendentes</div>
              </div>
            </div>
            <div className="mt-6 flex justify-center">
              <Link href="/dashboard/team" className="btn btn-primary">
                <UserGroupIcon className="h-4 w-4 mr-2" />
                Gerenciar Equipe
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}