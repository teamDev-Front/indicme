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
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

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
    leads: number
    conversions: number
    commissions: number
    conversionRate: number
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
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [reportType, setReportType] = useState('overview')
  const supabase = createClient()

  useEffect(() => {
    if (profile && (profile.role !== 'consultant')) {
      fetchReportData()
    }
  }, [profile, dateRange])

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

      let leadsQuery = supabase
        .from('leads')
        .select(`
          *,
          users:indicated_by (
            id,
            full_name,
            email
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

      // Calcular métricas principais
      const totalLeads = leads.length
      const convertedLeads = leads.filter(l => l.status === 'converted').length
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0)
      const paidCommissions = commissions
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0)
      const pendingCommissions = commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0)

      // Top performers
      const performanceMap = new Map()
      
      leads.forEach(lead => {
        const consultantId = lead.indicated_by
        const consultant = leads.find(l => l.indicated_by === consultantId)?.users
        
        if (!consultant) return
        
        if (!performanceMap.has(consultantId)) {
          performanceMap.set(consultantId, {
            id: consultantId,
            name: consultant.full_name,
            leads: 0,
            conversions: 0,
            commissions: 0,
            conversionRate: 0
          })
        }
        
        const performance = performanceMap.get(consultantId)
        performance.leads += 1
        
        if (lead.status === 'converted') {
          performance.conversions += 1
        }
      })

      commissions.forEach(commission => {
        if (performanceMap.has(commission.user_id)) {
          const performance = performanceMap.get(commission.user_id)
          if (commission.status === 'paid') {
            performance.commissions += commission.amount
          }
        }
      })

      // Calcular conversion rate para cada consultor
      performanceMap.forEach(performance => {
        performance.conversionRate = performance.leads > 0 
          ? (performance.conversions / performance.leads) * 100 
          : 0
      })

      const topPerformers = Array.from(performanceMap.values())
        .sort((a, b) => b.conversions - a.conversions)
        .slice(0, 5)

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
          commissions: monthCommissions.reduce((sum, c) => sum + c.amount, 0)
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
        leadsByStatus
      })
    } catch (error: any) {
      console.error('Erro ao buscar dados do relatório:', error)
      toast.error('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
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
        
        {/* <button onClick={exportReport} className="btn btn-primary">
          <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
          Exportar Relatório
        </button> */}
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Tipo de Relatório
              </label>
              <select
                className="input"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="overview">Visão Geral</option>
                <option value="performance">Performance</option>
                <option value="commissions">Comissões</option>
                <option value="trends">Tendências</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => setDateRange({
                  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
                  endDate: new Date().toISOString().split('T')[0]
                })}
                className="btn btn-secondary w-full"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Este Mês
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
                      <div className="text-sm font-medium text-secondary-900">
                        {performer.leads}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-success-600">
                        {performer.conversions}
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
                        <button className="btn btn-ghost btn-sm">
                          <EyeIcon className="h-3 w-3" />
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
    </div>
  )
}