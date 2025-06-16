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
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

interface DashboardStats {
  totalLeads: number
  convertedLeads: number
  pendingCommissions: number
  totalCommissions: number
  recentLeads: any[]
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    convertedLeads: 0,
    pendingCommissions: 0,
    totalCommissions: 0,
    recentLeads: []
  })
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

      // Buscar estatísticas baseadas no role do usuário
      let leadsQuery = supabase.from('leads').select('*')
      let commissionsQuery = supabase.from('commissions').select('*')

      if (profile?.role === 'consultant') {
        // Consultor vê apenas seus próprios leads e comissões
        leadsQuery = leadsQuery.eq('indicated_by', profile.id)
        commissionsQuery = commissionsQuery.eq('user_id', profile.id)
      } else if (profile?.role === 'manager') {
        // Manager vê leads de sua equipe
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)
        
        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id) // Incluir o próprio manager
        
        leadsQuery = leadsQuery.in('indicated_by', consultantIds)
        commissionsQuery = commissionsQuery.in('user_id', consultantIds)
      }
      // Clinic admin/viewer veem tudo da clínica (sem filtros adicionais)

      const [leadsData, commissionsData] = await Promise.all([
        leadsQuery,
        commissionsQuery
      ])

      if (leadsData.error) throw leadsData.error
      if (commissionsData.error) throw commissionsData.error

      const leads = leadsData.data || []
      const commissions = commissionsData.data || []

      // Calcular estatísticas
      const convertedLeads = leads.filter(lead => lead.status === 'converted').length
      const pendingCommissions = commissions
        .filter(comm => comm.status === 'pending')
        .reduce((sum, comm) => sum + comm.amount, 0)
      const totalCommissions = commissions
        .filter(comm => comm.status === 'paid')
        .reduce((sum, comm) => sum + comm.amount, 0)

      // Leads recentes (últimos 5)
      const recentLeads = leads
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)

      setStats({
        totalLeads: leads.length,
        convertedLeads,
        pendingCommissions,
        totalCommissions,
        recentLeads
      })
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircleIcon className="h-4 w-4 text-success-500" />
      case 'new':
      case 'contacted':
      case 'scheduled':
        return <ClockIcon className="h-4 w-4 text-warning-500" />
      case 'lost':
        return <XCircleIcon className="h-4 w-4 text-danger-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-secondary-400" />
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

  const conversionRate = stats.totalLeads > 0 ? (stats.convertedLeads / stats.totalLeads) * 100 : 0

  const statsCards = [
    {
      name: 'Total de Leads',
      value: stats.totalLeads,
      icon: UsersIcon,
      color: 'primary',
      change: '+12%',
      changeType: 'increase'
    },
    {
      name: 'Taxa de Conversão',
      value: `${conversionRate.toFixed(1)}%`,
      icon: ChartBarIcon,
      color: 'success',
      change: '+5.2%',
      changeType: 'increase'
    },
    {
      name: 'Comissões Pendentes',
      value: `R$ ${stats.pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: ClockIcon,
      color: 'warning',
      change: 'Aguardando',
      changeType: 'neutral'
    },
    {
      name: 'Total Recebido',
      value: `R$ ${stats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: CurrencyDollarIcon,
      color: 'success',
      change: '+18%',
      changeType: 'increase'
    }
  ]

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
          Bem vindo, {profile?.full_name}
        </h1>
        <p className="text-secondary-600">
          Aqui está um resumo da sua atividade recente.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((item, index) => (
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
                      <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                        item.changeType === 'increase' 
                          ? 'text-success-600' 
                          : item.changeType === 'decrease' 
                          ? 'text-danger-600' 
                          : 'text-secondary-500'
                      }`}>
                        {item.changeType === 'increase' && <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />}
                        {item.changeType === 'decrease' && <ArrowTrendingDownIcon className="w-3 h-3 mr-1" />}
                        {item.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recent Leads */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="card"
      >
        <div className="card-header">
          <h3 className="text-lg font-medium text-secondary-900">Leads Recentes</h3>
        </div>
        <div className="card-body">
          {stats.recentLeads.length > 0 ? (
            <div className="space-y-4">
              {stats.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-3 border-b border-secondary-100 last:border-b-0">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getStatusIcon(lead.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-secondary-900 truncate">
                        {lead.full_name}
                      </p>
                      <p className="text-sm text-secondary-500 truncate">
                        {lead.phone} • {lead.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`badge badge-${
                      lead.status === 'converted' ? 'success' :
                      lead.status === 'lost' ? 'danger' :
                      'warning'
                    }`}>
                      {getStatusText(lead.status)}
                    </span>
                    <span className="text-xs text-secondary-400">
                      {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <UsersIcon className="mx-auto h-12 w-12 text-secondary-400" />
              <h3 className="mt-2 text-sm font-medium text-secondary-900">Nenhum lead encontrado</h3>
              <p className="mt-1 text-sm text-secondary-500">
                Comece criando seu primeiro lead.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}