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

const contarArcadasUnicas = (comissoesFiltradas: any[]) => {
  const leadsUnicos = new Map()
  comissoesFiltradas.forEach(c => {
    if (c.lead_id && !leadsUnicos.has(c.lead_id)) {
      leadsUnicos.set(c.lead_id, c.arcadas_vendidas || 1)
    }
  })
  return Array.from(leadsUnicos.values()).reduce((sum, arcadas) => sum + arcadas, 0)
}

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
  is_indication_commission: boolean
  lead_id: string
  user_id: string
  establishment?: {
    name: string
  }
  leads?: {
    id: string
    full_name: string
    phone: string
    status: string
    created_at: string
    arcadas_vendidas: number
    converted_at?: string
  }
  users?: {
    full_name: string
    email: string
    role: string
  }
}

interface CommissionStats {
  total: number
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
    total: 0,
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

      if (!profile) return

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile.id)
        .single()

      if (!userClinic) return

      // Query principal para buscar comissões
      let query = supabase
        .from('commissions')
        .select(`
      *,
      leads!commissions_lead_id_fkey (
        id,
        full_name,
        phone,
        status,
        arcadas_vendidas,
        establishment_code,
        created_at,
        converted_at
      ),
      users!commissions_user_id_fkey (
        id,
        full_name,
        email,
        role
      ),
      establishment_codes!left (
        code,
        name
      )
    `)
        .eq('clinic_id', userClinic.clinic_id)
        .order('created_at', { ascending: false })

      // Filtros por role
      if (profile.role === 'consultant') {
        query = query.eq('user_id', profile.id)
      } else if (profile.role === 'manager') {
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        consultantIds.push(profile.id)

        if (consultantIds.length > 0) {
          query = query.in('user_id', consultantIds)
        } else {
          query = query.eq('user_id', profile.id)
        }
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ Erro na query de comissões:', error)
        throw error
      }

      console.log('✅ Comissões carregadas:', data?.length || 0)

      // Processar dados com estrutura corrigida
      const processedCommissions = (data || []).map(commission => {
        // 🔥 CORRIGIDO: Garantir que arcadas_vendidas vem da comissão, não do lead
        const arcadasVendidas = commission.arcadas_vendidas ||
          commission.leads?.arcadas_vendidas ||
          1

        return {
          ...commission,
          // Dados do lead
          leads: commission.leads ? {
            id: commission.leads.id,
            full_name: commission.leads.full_name || 'Nome não disponível',
            phone: commission.leads.phone || 'Telefone não informado',
            status: commission.leads.status || 'unknown',
            arcadas_vendidas: arcadasVendidas, // 🔥 CORRIGIDO: Usar valor da comissão
            establishment_code: commission.leads.establishment_code,
            created_at: commission.leads.created_at,
            converted_at: commission.leads.converted_at
          } : null,

          // Dados do usuário
          users: commission.users ? {
            id: commission.users.id,
            full_name: commission.users.full_name || 'Usuário não identificado',
            email: commission.users.email || 'Email não disponível',
            role: commission.users.role || 'consultant'
          } : null,

          // Dados do estabelecimento
          establishment: commission.establishment_codes ? {
            code: commission.establishment_codes.code,
            name: commission.establishment_codes.name || commission.establishment_codes.code
          } : null,

          // 🔥 CORRIGIDO: Garantir que arcadas_vendidas está no nível da comissão
          arcadas_vendidas: arcadasVendidas
        }
      })

      // 🔥 NOVO: Filtrar duplicatas por lead_id + user_id + type
      const uniqueCommissions = processedCommissions.filter((commission, index, array) => {
        const key = `${commission.lead_id}-${commission.user_id}-${commission.type}`
        return array.findIndex(c => `${c.lead_id}-${c.user_id}-${c.type}` === key) === index
      })

      console.log('🔍 Comissões antes da deduplicação:', processedCommissions.length)
      console.log('🔍 Comissões após deduplicação:', uniqueCommissions.length)

      if (processedCommissions.length !== uniqueCommissions.length) {
        console.warn('⚠️ Encontradas comissões duplicadas! Mostrando apenas únicas.')
      }

      setCommissions(uniqueCommissions)

      // Calcular estatísticas com dados processados
      const totalCommissions = uniqueCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)
      const paidCommissions = uniqueCommissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + (c.amount || 0), 0)
      const pendingCommissions = uniqueCommissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.amount || 0), 0)
      const cancelledCommissions = uniqueCommissions.filter(c => c.status === 'cancelled').reduce((sum, c) => sum + (c.amount || 0), 0)

      // Calcular comissões deste mês
      const thisMonth = new Date()
      const firstDayOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
      const monthlyCommissions = uniqueCommissions.filter(c =>
        new Date(c.created_at) >= firstDayOfMonth && c.status === 'paid'
      ).reduce((sum, c) => sum + (c.amount || 0), 0)

      // 🔥 CORREÇÃO: Contar arcadas apenas uma vez por lead (evitar duplicação)
      const leadsUnicos = new Set()
      const totalArcadasReais = uniqueCommissions.reduce((sum, commission) => {
        // Só contar arcadas uma vez por lead
        if (!leadsUnicos.has(commission.lead_id)) {
          leadsUnicos.add(commission.lead_id)
          return sum + (commission.arcadas_vendidas || 1)
        }
        return sum
      }, 0)

      // Calcular taxa de conversão baseada nos leads vinculados
      const leadsComComissao = uniqueCommissions.filter(c => c.leads).length
      const leadsConvertidos = uniqueCommissions.filter(c => c.leads?.status === 'converted').length
      const conversionRate = leadsComComissao > 0 ? (leadsConvertidos / leadsComComissao) * 100 : 0

      setStats({
        total: uniqueCommissions.length,
        totalPending: pendingCommissions,
        totalPaid: paidCommissions,
        totalCancelled: cancelledCommissions,
        averageCommission: uniqueCommissions.length > 0 ? totalCommissions / uniqueCommissions.length : 0,
        monthlyEarnings: monthlyCommissions,
        conversionRate: conversionRate,
        totalArcadas: totalArcadasReais // 🔥 USAR CONTAGEM CORRETA SEM DUPLICAÇÃO
      })

      console.log('✅ Stats calculadas:', {
        total: uniqueCommissions.length,
        totalPaid: paidCommissions,
        totalPending: pendingCommissions,
        totalArcadas: totalArcadasReais, // 🔥 MOSTRAR VALOR CORRIGIDO NO LOG
        totalArcadasAntes: uniqueCommissions.reduce((sum, c) => sum + (c.arcadas_vendidas || 1), 0) // Debug
      })

    } catch (error: any) {
      console.error('❌ Erro ao buscar comissões:', error)
      toast.error('Erro ao carregar comissões')
    } finally {
      setLoading(false)
    }
  }

  const getLeadStatusLabel = (status: string) => {
    const statusMap = {
      'new': 'Novo',
      'contacted': 'Contatado',
      'scheduled': 'Agendado',
      'converted': 'Convertido',
      'lost': 'Perdido'
    }
    return statusMap[status as keyof typeof statusMap] || status
  }

  // Função helper para obter a cor do status do lead
  const getLeadStatusColor = (status: string) => {
    const colorMap = {
      'new': 'bg-blue-100 text-blue-800',
      'contacted': 'bg-yellow-100 text-yellow-800',
      'scheduled': 'bg-purple-100 text-purple-800',
      'converted': 'bg-green-100 text-green-800',
      'lost': 'bg-red-100 text-red-800'
    }
    return colorMap[status as keyof typeof colorMap] || 'bg-gray-100 text-gray-800'
  }

  const handlePayCommission = async (commissionId: string) => {
    // 🔥 ALTERAÇÃO: Apenas clinic_admin pode pagar comissões
    if (!profile || profile.role !== 'clinic_admin') {
      toast.error('Apenas administradores da clínica podem pagar comissões')
      return
    }

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
    // 🔥 ALTERAÇÃO: Apenas clinic_admin pode cancelar comissões
    if (!profile || profile.role !== 'clinic_admin') {
      toast.error('Apenas administradores da clínica podem cancelar comissões')
      return
    }

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

  // 🔥 ALTERAÇÃO: Apenas clinic_admin pode gerenciar comissões
  const canManageCommissions = profile?.role === 'clinic_admin'

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
              : 'Visualize todas as comissões da clínica'
            }
          </p>
        </div>

        {/* {canManageCommissions && (
          <button className="btn btn-secondary">
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Exportar Relatório
          </button>
        )} */}
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
                <div className="text-xs text-secondary-400">
                  {contarArcadasUnicas(commissions.filter(c => c.status === 'pending'))} arcadas
                </div>
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
                <div className="text-xs text-secondary-400">
                  {contarArcadasUnicas(commissions.filter(c => c.status === 'paid'))} arcadas
                </div>
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
                  {stats.totalArcadas}  
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
                <div className="text-xs text-secondary-400">
                  {contarArcadasUnicas(commissions.filter(c => {
                    const commissionDate = new Date(c.created_at)
                    const currentMonth = new Date()
                    return commissionDate.getMonth() === currentMonth.getMonth() &&
                      commissionDate.getFullYear() === currentMonth.getFullYear()
                  }))} arcadas
                </div>
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
                  {contarArcadasUnicas(commissions.filter(c => c.status === 'cancelled'))} arcadas
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
                    {/* CORREÇÃO: Coluna Lead com informações mais detalhadas */}
                    <td>
                      <div>
                        <div className="font-medium text-secondary-900">
                          {commission.leads?.full_name || 'Lead não identificado'}
                        </div>
                        <div className="text-sm text-secondary-500">
                          {commission.leads?.phone || 'Telefone não informado'}
                        </div>
                        {/* CORREÇÃO: Status do lead mais informativo */}
                        {commission.leads?.status && (
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLeadStatusColor(commission.leads.status)}`}>
                              {getLeadStatusLabel(commission.leads.status)}
                            </span>
                          </div>
                        )}
                        {/* CORREÇÃO: Mostrar data de criação/conversão */}
                        <div className="text-xs text-secondary-400 mt-1">
                          {commission.leads?.status === 'converted' && commission.leads?.converted_at
                            ? `Convertido em ${new Date(commission.leads.converted_at).toLocaleDateString('pt-BR')}`
                            : commission.leads?.created_at
                              ? `Criado em ${new Date(commission.leads.created_at).toLocaleDateString('pt-BR')}`
                              : 'Data não disponível'
                          }
                        </div>
                      </div>
                    </td>

                    {/* CORREÇÃO: Coluna Consultor (apenas se não for consultor logado) */}
                    {profile?.role !== 'consultant' && (
                      <td>
                        <div>
                          <div className="text-sm text-secondary-900">
                            {commission.users?.full_name || 'Consultor não identificado'}
                          </div>
                          <div className="text-xs text-secondary-500">
                            {commission.users?.email || 'Email não disponível'}
                          </div>
                          {/* CORREÇÃO: Mostrar role do usuário */}
                          <div className="text-xs text-primary-600 mt-1">
                            {commission.users?.role === 'manager' ? '👑 Gerente' :
                              commission.users?.role === 'consultant' ? '👤 Consultor' :
                                '❓ Função não definida'}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* CORREÇÃO: Coluna Arcadas com informações mais claras */}
                    <td>
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary-600">
                          {commission.arcadas_vendidas || 1}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {(commission.arcadas_vendidas || 1) === 1 ? 'Superior OU Inferior' : 'Superior E Inferior'}
                        </div>
                        {/* Mostrar estabelecimento se disponível */}
                        {commission.establishment?.name && (
                          <div className="text-xs text-blue-600 mt-1">
                            📍 {commission.establishment.name}
                          </div>
                        )}
                        {/* 🔥 NOVO: Debug info para verificar dados */}
                        {process.env.NODE_ENV === 'development' && (
                          <div className="text-xs text-gray-400 mt-1">
                            DB: {commission.arcadas_vendidas} | Lead: {commission.leads?.arcadas_vendidas}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CORREÇÃO: Coluna Valor Total com breakdown */}
                    <td>
                      <div>
                        <div className="text-lg font-bold text-success-600">
                          R$ {(commission.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        {/* Breakdown do valor */}
                        <div className="text-xs text-secondary-500 space-y-1">
                          {commission.valor_por_arcada && commission.arcadas_vendidas && (
                            <div>
                              Base: R$ {commission.valor_por_arcada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              × {commission.arcadas_vendidas} arcada{commission.arcadas_vendidas > 1 ? 's' : ''}
                            </div>
                          )}
                          {/* 🔥 NOVO: Mostrar cálculo detalhado para debug */}
                          {process.env.NODE_ENV === 'development' && (
                            <div className="text-xs text-gray-400">
                              Cálculo: {commission.valor_por_arcada || 0} × {commission.arcadas_vendidas || 1} + {commission.valor_bonus || 0} = {commission.amount}
                            </div>
                          )}
                        </div>
                        {/* Indicar se é comissão de indicação */}
                        {commission.is_indication_commission && (
                          <div className="text-xs text-purple-600 font-medium mt-1">
                            🔗 Comissão de Indicação
                          </div>
                        )}
                      </div>
                    </td>

                    {/* CORREÇÃO: Coluna Tipo mais clara */}
                    <td>
                      <div className="text-center">
                        <span className={`badge ${getTypeColor(commission.type)}`}>
                          {commission.type === 'consultant' ? '👤 Consultor' : '👑 Manager'}
                        </span>
                        {/* CORREÇÃO: Mostrar percentual se for indicação */}
                        {commission.is_indication_commission && commission.percentage && commission.percentage !== 100 && (
                          <div className="text-xs text-purple-600 mt-1">
                            {commission.percentage}% da comissão
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Coluna Status (mantida igual) */}
                    <td>
                      <span className={`badge badge-${getStatusColor(commission.status)} flex items-center`}>
                        {getStatusIcon(commission.status)}
                        <span className="ml-1">
                          {commission.status === 'pending' ? 'Pendente' :
                            commission.status === 'paid' ? 'Pago' : 'Cancelado'}
                        </span>
                      </span>
                    </td>

                    {/* CORREÇÃO: Coluna Data com mais informações */}
                    <td>
                      <div className="text-sm text-secondary-900">
                        {new Date(commission.created_at).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-secondary-500">
                        {new Date(commission.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      {commission.paid_at && (
                        <div className="text-xs text-success-600 mt-1">
                          💰 Pago em {new Date(commission.paid_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </td>

                    {/* 🔥 ALTERAÇÃO: Coluna Ações apenas para clinic_admin */}
                    {canManageCommissions && (
                      <td>
                        <div className="flex items-center space-x-2">
                          {commission.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handlePayCommission(commission.id)}
                                disabled={payingCommission === commission.id}
                                className="btn btn-success btn-sm"
                                title="Pagar comissão"
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
                                title="Cancelar comissão"
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

                    {/* {!canManageCommissions && profile?.role !== 'consultant' && (
                      <td>
                        <div className="text-xs text-secondary-400 text-center">
                          <span title="Apenas administradores da clínica podem gerenciar comissões">
                            🔒 Sem permissão
                          </span>
                        </div>
                      </td>
                    )} */}
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