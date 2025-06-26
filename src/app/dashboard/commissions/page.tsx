'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  BanknotesIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowDownTrayIcon,
  StarIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface Commission {
  id: string
  amount: number
  percentage: number
  valor_por_arcada: number
  arcadas_vendidas: number
  valor_bonus: number
  bonus_conquistados: number
  type: 'consultant' | 'manager'
  status: 'pending' | 'paid' | 'cancelled'
  paid_at: string | null
  created_at: string
  lead_id: string
  user_id: string
  leads?: {
    id: string
    full_name: string
    phone: string
    status: string
    created_at: string
    arcadas_vendidas: number
  }
  users?: {
    full_name: string
    email: string
  }
}

interface CommissionStats {
  totalPending: number
  totalPaid: number
  totalCancelled: number
  averageCommission: number
  monthlyEarnings: number
  conversionRate: number
  totalArcadas: number
}

export default function CommissionsPage() {
  const { profile } = useAuth()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [stats, setStats] = useState<CommissionStats>({
    totalPending: 0,
    totalPaid: 0,
    totalCancelled: 0,
    averageCommission: 0,
    monthlyEarnings: 0,
    conversionRate: 0,
    totalArcadas: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [payingCommission, setPayingCommission] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (profile) {
      fetchCommissions()
    }
  }, [profile])

  const fetchCommissions = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('commissions')
        .select(`
        *,
        leads (
          id,
          full_name,
          phone,
          status,
          created_at,
          arcadas_vendidas
        ),
        users (
          full_name,
          email
        )
      `)
        .order('created_at', { ascending: false })

      // Filtrar baseado no role do usuário
      if (profile?.role === 'consultant') {
        query = query.eq('user_id', profile.id)
      } else if (profile?.role === 'manager') {
        // Manager vê comissões de sua equipe + próprias
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id)

        query = query.in('user_id', consultantIds)
      }
      // Clinic admin/viewer veem todas (sem filtros adicionais)

      const { data, error } = await query

      if (error) {
        throw error
      }

      const commissionsData = data || []
      setCommissions(commissionsData)

      // Calcular estatísticas baseadas nas arcadas
      const pending = commissionsData
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0)

      const paid = commissionsData
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0)

      const cancelled = commissionsData
        .filter(c => c.status === 'cancelled')
        .reduce((sum, c) => sum + c.amount, 0)

      // Total de arcadas vendidas
      const totalArcadas = commissionsData
        .reduce((sum, c) => sum + (c.leads?.arcadas_vendidas || 1), 0)

      const average = commissionsData.length > 0
        ? commissionsData.reduce((sum, c) => sum + c.amount, 0) / commissionsData.length
        : 0

      // Earnings deste mês
      const currentMonth = new Date()
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const monthlyEarnings = commissionsData
        .filter(c => c.status === 'paid' && new Date(c.paid_at || c.created_at) >= firstDayOfMonth)
        .reduce((sum, c) => sum + c.amount, 0)

      // Taxa de conversão (comissões pagas vs total)
      const conversionRate = commissionsData.length > 0
        ? (commissionsData.filter(c => c.status === 'paid').length / commissionsData.length) * 100
        : 0

      setStats({
        totalPending: pending,
        totalPaid: paid,
        totalCancelled: cancelled,
        averageCommission: average,
        monthlyEarnings,
        conversionRate,
        totalArcadas, // Adicione este campo às estatísticas
      })
    } catch (error: any) {
      console.error('Erro ao buscar comissões:', error)
      toast.error('Erro ao carregar comissões')
    } finally {
      setLoading(false)
    }
  }

  const handlePayCommission = async (commissionId: string) => {
    if (!profile || profile.role === 'consultant') return

    try {
      setPayingCommission(commissionId)

      const { error } = await supabase
        .from('commissions')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', commissionId)

      if (error) {
        throw error
      }

      setCommissions(prev => prev.map(commission =>
        commission.id === commissionId
          ? {
            ...commission,
            status: 'paid' as const,
            paid_at: new Date().toISOString()
          }
          : commission
      ))

      toast.success('Comissão paga com sucesso!')
      fetchCommissions() // Recarregar para atualizar stats
    } catch (error: any) {
      console.error('Erro ao pagar comissão:', error)
      toast.error('Erro ao pagar comissão')
    } finally {
      setPayingCommission(null)
    }
  }

  const handleCancelCommission = async (commissionId: string) => {
    if (!profile || profile.role === 'consultant') return

    try {
      const { error } = await supabase
        .from('commissions')
        .update({ status: 'cancelled' })
        .eq('id', commissionId)

      if (error) {
        throw error
      }

      setCommissions(prev => prev.map(commission =>
        commission.id === commissionId
          ? { ...commission, status: 'cancelled' as const }
          : commission
      ))

      toast.success('Comissão cancelada com sucesso!')
      fetchCommissions()
    } catch (error: any) {
      console.error('Erro ao cancelar comissão:', error)
      toast.error('Erro ao cancelar comissão')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircleIcon className="h-4 w-4" />
      case 'cancelled':
        return <XCircleIcon className="h-4 w-4" />
      default:
        return <ClockIcon className="h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'cancelled':
        return 'danger'
      default:
        return 'warning'
    }
  }

  const getTypeColor = (type: string) => {
    return type === 'manager' ? 'primary' : 'secondary'
  }

  // Filtrar comissões
  const filteredCommissions = commissions.filter(commission => {
    const matchesSearch = !searchTerm ||
      commission.leads?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      commission.leads?.phone.includes(searchTerm) ||
      commission.users?.full_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || commission.status === statusFilter
    const matchesType = !typeFilter || commission.type === typeFilter

    const matchesDate = !dateFilter ||
      new Date(commission.created_at).toDateString() === new Date(dateFilter).toDateString()

    return matchesSearch && matchesStatus && matchesType && matchesDate
  })

  const canManageCommissions = profile?.role === 'clinic_admin' || profile?.role === 'manager'

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
            {profile?.role === 'consultant' ? 'Minhas Comissões' : 'Comissões'}
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'consultant'
              ? 'Acompanhe seus ganhos e comissões'
              : 'Gerencie todas as comissões da clínica'
            }
          </p>
        </div>

        {canManageCommissions && (
          <button className="btn btn-secondary">
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Exportar Relatório
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <ClockIcon className="w-4 h-4 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Pendente</p>
                <p className="text-sm font-bold text-secondary-900">
                  R$ {stats.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-secondary-400">
                  {commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0)} arcadas
                </p>
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
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <CheckCircleIcon className="w-4 h-4 text-success-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Pago</p>
                <p className="text-sm font-bold text-secondary-900">
                  R$ {stats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-secondary-400">
                  {commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0)} arcadas
                </p>
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
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <TrophyIcon className="w-4 h-4 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Total Arcadas</p>
                <p className="text-sm font-bold text-secondary-900">
                  {commissions.reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0)}
                </p>
                <p className="text-xs text-secondary-400">
                  Vendidas no período
                </p>
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
                  <ArrowTrendingUpIcon className="w-4 h-4 text-success-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Este Mês</p>
                <p className="text-sm font-bold text-secondary-900">
                  R$ {stats.monthlyEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-secondary-400">
                  {commissions.filter(c => {
                    const commissionDate = new Date(c.created_at)
                    const currentMonth = new Date()
                    return commissionDate.getMonth() === currentMonth.getMonth() &&
                      commissionDate.getFullYear() === currentMonth.getFullYear()
                  }).reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0)} arcadas
                </p>
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
                  <StarIcon className="w-4 h-4 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Bônus Ganhos</p>
                <p className="text-sm font-bold text-secondary-900">
                  {commissions.reduce((sum, c) => sum + (c.bonus_conquistados || 0), 0)}
                </p>
                <p className="text-xs text-secondary-400">
                  R$ {commissions.reduce((sum, c) => sum + (c.valor_bonus || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
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
                <div className="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
                  <XCircleIcon className="w-4 h-4 text-danger-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Cancelado</p>
                <p className="text-sm font-bold text-secondary-900">
                  R$ {stats.totalCancelled.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-secondary-400">
                  {commissions.filter(c => c.status === 'cancelled').reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0)} arcadas
                </p>
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
                placeholder="Buscar comissões..."
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
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>

            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              <option value="consultant">Consultor</option>
              <option value="manager">Gerente</option>
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
                setTypeFilter('')
                setDateFilter('')
              }}
              className="btn btn-secondary"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Commissions Table */}
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
                  {profile?.role !== 'consultant' && <th>Consultor</th>}
                  <th>Arcadas Vendidas</th>
                  <th>Valor Total</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data</th>
                  {canManageCommissions && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map((commission) => (
                  <tr key={commission.id}>
                    <td>
                      <div>
                        <div className="font-medium text-secondary-900">
                          {commission.leads?.full_name}
                        </div>
                        <div className="text-sm text-secondary-500">
                          {commission.leads?.phone}
                        </div>
                        <div className="text-xs text-secondary-400">
                          Lead: {commission.leads?.status === 'converted' ? 'Convertido' :
                            commission.leads?.status === 'lost' ? 'Perdido' :
                              commission.leads?.status === 'contacted' ? 'Contatado' :
                                commission.leads?.status === 'scheduled' ? 'Agendado' : 'Novo'}
                        </div>
                      </div>
                    </td>
                    {profile?.role !== 'consultant' && (
                      <td>
                        <div className="text-sm text-secondary-900">
                          {commission.users?.full_name}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {commission.users?.email}
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary-600">
                          {commission.leads?.arcadas_vendidas || 1}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {(commission.leads?.arcadas_vendidas || 1) === 1 ? 'Superior OU Inferior' : 'Superior E Inferior'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div className="text-lg font-bold text-success-600">
                          R$ {commission.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {commission.type === 'consultant' ? 'Valor para consultor' : 'Valor para manager'}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${getTypeColor(commission.type)}`}>
                        {commission.type === 'consultant' ? 'Consultor' : 'Manager'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${getStatusColor(commission.status)} flex items-center`}>
                        {getStatusIcon(commission.status)}
                        <span className="ml-1">
                          {commission.status === 'pending' ? 'Pendente' :
                            commission.status === 'paid' ? 'Pago' : 'Cancelado'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <div className="text-sm text-secondary-900">
                        {new Date(commission.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      {commission.paid_at && (
                        <div className="text-xs text-success-600">
                          Pago em {new Date(commission.paid_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>
                    {canManageCommissions && (
                      <td>
                        <div className="flex items-center space-x-2">
                          {commission.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handlePayCommission(commission.id)}
                                disabled={payingCommission === commission.id}
                                className="btn btn-success btn-sm"
                                title="Pagar"
                              >
                                {payingCommission === commission.id ? (
                                  <div className="loading-spinner w-3 h-3"></div>
                                ) : (
                                  <CheckCircleIcon className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleCancelCommission(commission.id)}
                                className="btn btn-danger btn-sm"
                                title="Cancelar"
                              >
                                <XCircleIcon className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {commission.status !== 'pending' && (
                            <span className="text-xs text-secondary-500">
                              {commission.status === 'paid' ? 'Paga' : 'Cancelada'}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredCommissions.length === 0 && (
              <div className="text-center py-12">
                <CurrencyDollarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {commissions.length === 0 ? 'Nenhuma comissão encontrada' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {commissions.length === 0
                    ? 'As comissões aparecerão aqui quando leads forem convertidos.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}