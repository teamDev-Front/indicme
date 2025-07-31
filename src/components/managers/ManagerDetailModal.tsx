// src/components/managers/ManagerDetailModal.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  TrophyIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  StarIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface ManagerDetailData {
  manager: {
    id: string
    full_name: string
    email: string
    phone: string | null
    role: string
    status: string
    created_at: string
  }
  establishment_names: string[]
  team: Array<{
    id: string
    full_name: string
    email: string
    phone: string | null
    role: string
    status: string
    hierarchy_created_at: string
    leads_count: number
    converted_leads: number
    total_commissions: number
    paid_commissions: number
  }>
  leads: Array<{
    id: string
    full_name: string
    phone: string
    email: string | null
    status: string
    arcadas_vendidas: number | null
    created_at: string
    converted_at: string | null
    consultant_name?: string // 🔥 Opcional pois pode ser undefined
  }>
  commissions: Array<{
    id: string
    amount: number
    status: string
    type: string
    arcadas_vendidas: number
    valor_por_arcada: number
    bonus_conquistados: number
    valor_bonus: number
    created_at: string
    paid_at: string | null
  }>
  stats: {
    totalTeamMembers: number
    activeTeamMembers: number
    totalTeamLeads: number
    totalTeamConversions: number
    teamConversionRate: number
    totalManagerCommissions: number
    paidManagerCommissions: number
    pendingManagerCommissions: number
    totalTeamCommissions: number
    avgLeadsPerMonth: number
  }
}

interface ManagerDetailModalProps {
  isOpen: boolean
  onClose: () => void
  managerId: string | null
}

export default function ManagerDetailModal({
  isOpen,
  onClose,
  managerId
}: ManagerDetailModalProps) {
  const [data, setData] = useState<ManagerDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'leads' | 'commissions'>('overview')
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && managerId) {
      fetchManagerDetails()
    }
  }, [isOpen, managerId])

  const fetchManagerDetails = async () => {
    if (!managerId) return

    try {
      setLoading(true)
      console.log('📊 Buscando detalhes do gerente:', managerId)

      // 1. Buscar dados básicos do gerente
      const { data: managerInfo, error: managerError } = await supabase
        .from('users')
        .select('*')
        .eq('id', managerId)
        .single()

      if (managerError) throw managerError

      // 2. Buscar estabelecimentos do gerente
      const { data: establishmentData } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            name,
            description
          )
        `)
        .eq('user_id', managerId)
        .eq('status', 'active')

      // Processar estabelecimentos
      const establishmentNames: string[] = []
      if (establishmentData && establishmentData.length > 0) {
        for (const est of establishmentData) {
          if (est.establishment_codes) {
            const estData = Array.isArray(est.establishment_codes)
              ? est.establishment_codes[0]
              : est.establishment_codes
            
            if (estData && estData.name) {
              establishmentNames.push(estData.name)
            } else {
              establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
            }
          } else {
            establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
          }
        }
      }

      if (establishmentNames.length === 0) {
        establishmentNames.push('Sem estabelecimento')
      }

      // 3. Buscar equipe do gerente
      const { data: teamData } = await supabase
        .from('hierarchies')
        .select(`
          created_at,
          consultant_id,
          users!hierarchies_consultant_id_fkey (
            id,
            full_name,
            email,
            phone,
            role,
            status
          )
        `)
        .eq('manager_id', managerId)

      // 4. Para cada membro da equipe, buscar estatísticas
      const teamWithStats = await Promise.all(
        (teamData || [])
          .filter(teamMember => teamMember.users) // 🔥 Filtrar antes de mapear
          .map(async (teamMember) => {
            const consultant = Array.isArray(teamMember.users) 
              ? teamMember.users[0] 
              : teamMember.users

            if (!consultant) {
              console.warn('Consultor não encontrado para o membro da equipe:', teamMember)
              return null
            }

            try {
              // Buscar leads do consultor
              const { data: consultantLeads, count: leadsCount } = await supabase
                .from('leads')
                .select('id, status', { count: 'exact' })
                .eq('indicated_by', consultant.id)

              const convertedLeads = consultantLeads?.filter(l => l.status === 'converted').length || 0

              // Buscar comissões do consultor
              const { data: consultantCommissions } = await supabase
                .from('commissions')
                .select('amount, status')
                .eq('user_id', consultant.id)

              const totalCommissions = consultantCommissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
              const paidCommissions = consultantCommissions?.filter(c => c.status === 'paid')
                .reduce((sum, c) => sum + (c.amount || 0), 0) || 0

              return {
                id: consultant.id as string,
                full_name: consultant.full_name as string,
                email: consultant.email as string,
                phone: consultant.phone as string | null,
                role: consultant.role as string,
                status: consultant.status as string,
                hierarchy_created_at: teamMember.created_at as string,
                leads_count: leadsCount || 0,
                converted_leads: convertedLeads,
                total_commissions: totalCommissions,
                paid_commissions: paidCommissions,
              }
            } catch (error) {
              console.error('Erro ao buscar dados do consultor:', consultant.id, error)
              return null
            }
          })
      )

      // 🔥 Filtrar nulls e garantir tipagem correta
      const validTeam = teamWithStats.filter((member): member is NonNullable<typeof member> => member !== null)

      // 5. Buscar todos os leads da equipe
      const teamMemberIds = validTeam.map(member => member.id)
      let allTeamLeads: any[] = []

      if (teamMemberIds.length > 0) {
        const { data: teamLeadsData } = await supabase
          .from('leads')
          .select(`
            *,
            users!leads_indicated_by_fkey (
              full_name
            )
          `)
          .in('indicated_by', teamMemberIds)
          .order('created_at', { ascending: false })

        allTeamLeads = (teamLeadsData || []).map(lead => ({
          ...lead,
          consultant_name: Array.isArray(lead.users) ? lead.users[0]?.full_name : lead.users?.full_name
        }))
      }

      // 6. Buscar comissões do gerente
      const { data: managerCommissions } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', managerId)
        .order('created_at', { ascending: false })

      // 7. Calcular estatísticas
      const totalTeamMembers = validTeam.length
      const activeTeamMembers = validTeam.filter(member => member && member.status === 'active').length
      const totalTeamLeads = validTeam.reduce((sum, member) => sum + (member ? member.leads_count : 0), 0)
      const totalTeamConversions = validTeam.reduce((sum, member) => sum + (member ? member.converted_leads : 0), 0)
      const teamConversionRate = totalTeamLeads > 0 ? (totalTeamConversions / totalTeamLeads) * 100 : 0

      const totalManagerCommissions = managerCommissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const paidManagerCommissions = managerCommissions?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const pendingManagerCommissions = managerCommissions?.filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      const totalTeamCommissions = validTeam.reduce((sum, member) => sum + (member ? member.total_commissions : 0), 0)

      const membershipMonths = Math.max(1, Math.floor(
        (new Date().getTime() - new Date(managerInfo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ))
      const avgLeadsPerMonth = totalTeamLeads / membershipMonths

      setData({
        manager: managerInfo,
        establishment_names: establishmentNames,
        team: validTeam,
        leads: allTeamLeads,
        commissions: managerCommissions || [],
        stats: {
          totalTeamMembers,
          activeTeamMembers,
          totalTeamLeads,
          totalTeamConversions,
          teamConversionRate,
          totalManagerCommissions,
          paidManagerCommissions,
          pendingManagerCommissions,
          totalTeamCommissions,
          avgLeadsPerMonth,
        }
      })

      console.log('✅ Dados do gerente carregados')

    } catch (error: any) {
      console.error('❌ Erro ao buscar detalhes do gerente:', error)
      toast.error('Erro ao carregar detalhes do gerente')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted':
        return <CheckCircleIcon className="h-4 w-4 text-success-500" />
      case 'lost':
        return <XCircleIcon className="h-4 w-4 text-danger-500" />
      case 'scheduled':
        return <CalendarIcon className="h-4 w-4 text-primary-500" />
      case 'contacted':
        return <PhoneIcon className="h-4 w-4 text-warning-500" />
      default:
        return <ClockIcon className="h-4 w-4 text-secondary-500" />
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'new': 'Novo',
      'contacted': 'Contatado',
      'scheduled': 'Agendado',
      'converted': 'Convertido',
      'lost': 'Perdido'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'new': 'secondary',
      'contacted': 'warning',
      'scheduled': 'primary',
      'converted': 'success',
      'lost': 'danger'
    }
    return colors[status] || 'secondary'
  }

  if (!managerId) return null

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-success-600 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-white">
                        {data?.manager.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                        {data?.manager.full_name || 'Carregando...'}
                      </Dialog.Title>
                      <p className="text-sm text-secondary-500">
                        {data?.manager.email} • {data?.establishment_names.join(', ')}
                      </p>
                      <p className="text-sm text-success-600 font-medium">Gerente</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="loading-spinner w-8 h-8 mr-3"></div>
                    <span className="text-secondary-600">Carregando detalhes...</span>
                  </div>
                ) : data ? (
                  <div>
                    {/* Tabs */}
                    <div className="border-b border-secondary-200">
                      <nav className="flex space-x-8 px-6">
                        <button
                          onClick={() => setActiveTab('overview')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'overview'
                              ? 'border-success-500 text-success-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Visão Geral
                        </button>
                        <button
                          onClick={() => setActiveTab('team')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'team'
                              ? 'border-success-500 text-success-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Equipe ({data.stats.totalTeamMembers})
                        </button>
                        <button
                          onClick={() => setActiveTab('leads')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'leads'
                              ? 'border-success-500 text-success-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Leads da Equipe ({data.stats.totalTeamLeads})
                        </button>
                        <button
                          onClick={() => setActiveTab('commissions')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'commissions'
                              ? 'border-success-500 text-success-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Comissões ({data.commissions.length})
                        </button>
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeTab === 'overview' && (
                        <div className="space-y-6">
                          {/* Performance Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <UserGroupIcon className="h-8 w-8 text-success-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-success-900">{data.stats.totalTeamMembers}</div>
                                  <div className="text-sm text-success-700">Membros na Equipe</div>
                                  <div className="text-xs text-success-600">{data.stats.activeTeamMembers} ativos</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <UsersIcon className="h-8 w-8 text-primary-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-primary-900">{data.stats.totalTeamLeads}</div>
                                  <div className="text-sm text-primary-700">Leads da Equipe</div>
                                  <div className="text-xs text-primary-600">{data.stats.avgLeadsPerMonth.toFixed(1)}/mês</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <TrophyIcon className="h-8 w-8 text-purple-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-purple-900">{data.stats.totalTeamConversions}</div>
                                  <div className="text-sm text-purple-700">Conversões da Equipe</div>
                                  <div className="text-xs text-purple-600">{data.stats.teamConversionRate.toFixed(1)}% taxa</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <CurrencyDollarIcon className="h-8 w-8 text-warning-600 mr-3" />
                                <div>
                                  <div className="text-lg font-bold text-warning-900">
                                    R$ {data.stats.paidManagerCommissions.toLocaleString('pt-BR')}
                                  </div>
                                  <div className="text-sm text-warning-700">Comissões Pagas</div>
                                  <div className="text-xs text-warning-600">
                                    R$ {data.stats.pendingManagerCommissions.toLocaleString('pt-BR')} pendente
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Informações Pessoais */}
                          <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-6">
                            <h4 className="text-lg font-medium text-secondary-900 mb-4">Informações do Gerente</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <div className="flex items-center">
                                  <EnvelopeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">{data.manager.email}</div>
                                    <div className="text-sm text-secondary-500">Email</div>
                                  </div>
                                </div>

                                {data.manager.phone && (
                                  <div className="flex items-center">
                                    <PhoneIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                    <div>
                                      <div className="font-medium text-secondary-900">{data.manager.phone}</div>
                                      <div className="text-sm text-secondary-500">Telefone</div>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center">
                                  <BuildingOfficeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">
                                      {data.establishment_names.join(', ')}
                                    </div>
                                    <div className="text-sm text-secondary-500">Estabelecimentos</div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center">
                                  <CalendarIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">
                                      {new Date(data.manager.created_at).toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-secondary-500">Data de cadastro</div>
                                  </div>
                                </div>

                                <div className="flex items-center">
                                  <ArrowTrendingUpIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">
                                      {data.stats.avgLeadsPerMonth.toFixed(1)} leads/mês
                                    </div>
                                    <div className="text-sm text-secondary-500">Média da equipe</div>
                                  </div>
                                </div>

                                <div className="flex items-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    data.manager.status === 'active' 
                                      ? 'bg-success-100 text-success-800'
                                      : 'bg-danger-100 text-danger-800'
                                  }`}>
                                    {data.manager.status === 'active' ? 'Ativo' : 'Inativo'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Performance Summary */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white border border-secondary-200 rounded-lg p-6">
                              <h4 className="text-lg font-medium text-secondary-900 mb-4">Performance da Equipe</h4>
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Total de Leads</span>
                                  <span className="text-lg font-bold text-primary-600">{data.stats.totalTeamLeads}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Conversões</span>
                                  <span className="text-lg font-bold text-success-600">{data.stats.totalTeamConversions}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Taxa de Conversão</span>
                                  <span className="text-lg font-bold text-purple-600">{data.stats.teamConversionRate.toFixed(1)}%</span>
                                </div>
                                <div className="pt-2 border-t">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-secondary-900">Comissões da Equipe</span>
                                    <span className="text-xl font-bold text-warning-600">
                                      R$ {data.stats.totalTeamCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white border border-secondary-200 rounded-lg p-6">
                              <h4 className="text-lg font-medium text-secondary-900 mb-4">Comissões do Gerente</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Pagas</span>
                                  <div className="flex items-center">
                                    <span className="text-lg font-bold text-success-600 mr-2">
                                      R$ {data.stats.paidManagerCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Pendentes</span>
                                  <div className="flex items-center">
                                    <span className="text-lg font-bold text-warning-600 mr-2">
                                      R$ {data.stats.pendingManagerCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                                <div className="pt-2 border-t">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-secondary-900">Total</span>
                                    <span className="text-xl font-bold text-success-600">
                                      R$ {data.stats.totalManagerCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'team' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-medium text-secondary-900">
                              Equipe do Gerente ({data.team.length})
                            </h4>
                          </div>

                          <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-secondary-200">
                                <thead className="bg-secondary-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Consultor
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Contato
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Performance
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Conversão
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Comissões
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Na Equipe Desde
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-200">
                                  {data.team.map((member) => (
                                    <tr key={member.id} className="hover:bg-secondary-50">
                                      <td className="px-6 py-4">
                                        <div className="flex items-center">
                                          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-medium mr-3">
                                            {member.full_name.charAt(0).toUpperCase()}
                                          </div>
                                          <div>
                                            <div className="font-medium text-secondary-900">{member.full_name}</div>
                                            <div className="text-sm text-secondary-500">{member.role}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm text-secondary-600">{member.email}</div>
                                        {member.phone && (
                                          <div className="text-sm text-secondary-500">{member.phone}</div>
                                        )}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center space-x-4">
                                          <div className="text-center">
                                            <div className="text-sm font-medium text-primary-600">
                                              {member.leads_count}
                                            </div>
                                            <div className="text-xs text-secondary-500">Leads</div>
                                          </div>
                                          <div className="text-center">
                                            <div className="text-sm font-medium text-success-600">
                                              {member.converted_leads}
                                            </div>
                                            <div className="text-xs text-secondary-500">Convertidos</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                        <div className="text-lg font-bold text-success-600">
                                          {member.leads_count > 0 ? 
                                            ((member.converted_leads / member.leads_count) * 100).toFixed(1) : 0}%
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-success-600">
                                          R$ {member.paid_commissions.toLocaleString('pt-BR')}
                                        </div>
                                        <div className="text-xs text-secondary-500">
                                          Total: R$ {member.total_commissions.toLocaleString('pt-BR')}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`badge ${
                                          member.status === 'active' ? 'badge-success' :
                                          member.status === 'inactive' ? 'badge-danger' : 'badge-warning'
                                        }`}>
                                          {member.status === 'active' ? 'Ativo' :
                                           member.status === 'inactive' ? 'Inativo' : 'Pendente'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-secondary-500">
                                        {new Date(member.hierarchy_created_at).toLocaleDateString('pt-BR')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {data.team.length === 0 && (
                                <div className="text-center py-8">
                                  <UserGroupIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                                  <p className="text-secondary-500">Nenhum membro na equipe</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'leads' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-medium text-secondary-900">
                              Leads da Equipe ({data.leads.length})
                            </h4>
                          </div>

                          <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-secondary-200">
                                <thead className="bg-secondary-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Lead
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Contato
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Consultor
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Arcadas
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Data
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-200">
                                  {data.leads.slice(0, 20).map((lead) => (
                                    <tr key={lead.id} className="hover:bg-secondary-50">
                                      <td className="px-6 py-4">
                                        <div className="font-medium text-secondary-900">{lead.full_name}</div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm text-secondary-600">{lead.phone}</div>
                                        {lead.email && (
                                          <div className="text-sm text-secondary-500">{lead.email}</div>
                                        )}
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="text-sm text-secondary-900">
                                          {lead.consultant_name || 'Consultor não identificado'}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium badge-${getStatusColor(lead.status)}`}>
                                          {getStatusIcon(lead.status)}
                                          <span className="ml-1">{getStatusLabel(lead.status)}</span>
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        {lead.status === 'converted' ? (
                                          <div className="flex items-center">
                                            <StarIcon className="h-4 w-4 text-warning-500 mr-1" />
                                            <span className="font-medium text-primary-600">
                                              {lead.arcadas_vendidas || 1}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-secondary-400">-</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 text-sm text-secondary-500">
                                        <div>{new Date(lead.created_at).toLocaleDateString('pt-BR')}</div>
                                        {lead.converted_at && (
                                          <div className="text-success-600">
                                            Convertido: {new Date(lead.converted_at).toLocaleDateString('pt-BR')}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {data.leads.length === 0 && (
                                <div className="text-center py-8">
                                  <UsersIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                                  <p className="text-secondary-500">Nenhum lead encontrado</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {data.leads.length > 20 && (
                            <div className="text-center text-sm text-secondary-500">
                              Mostrando os 20 leads mais recentes de {data.leads.length} total
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'commissions' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-medium text-secondary-900">
                              Comissões do Gerente ({data.commissions.length})
                            </h4>
                            <div className="text-sm text-secondary-600">
                              Total: R$ {data.stats.totalManagerCommissions.toLocaleString('pt-BR')}
                            </div>
                          </div>

                          <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-secondary-200">
                                <thead className="bg-secondary-50">
                                  <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Valor
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Arcadas
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Bônus
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                      Data
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-secondary-200">
                                  {data.commissions.map((commission) => (
                                    <tr key={commission.id} className="hover:bg-secondary-50">
                                      <td className="px-6 py-4">
                                        <div className="font-bold text-lg text-success-600">
                                          R$ {commission.amount.toLocaleString('pt-BR')}
                                        </div>
                                        <div className="text-xs text-secondary-500">
                                          R$ {commission.valor_por_arcada.toLocaleString('pt-BR')}/arcada
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className="badge badge-success">
                                          Gerente
                                        </span>
                                      </td>
                                      <td className="px-6 py-4">
                                        <div className="flex items-center">
                                          <TrophyIcon className="h-4 w-4 text-warning-500 mr-1" />
                                          <span className="font-medium">{commission.arcadas_vendidas}</span>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        {commission.bonus_conquistados > 0 ? (
                                          <div>
                                            <div className="font-medium text-success-600">
                                              R$ {commission.valor_bonus.toLocaleString('pt-BR')}
                                            </div>
                                            <div className="text-xs text-success-500">
                                              {commission.bonus_conquistados}x bônus
                                            </div>
                                          </div>
                                        ) : (
                                          <span className="text-secondary-400">-</span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`badge ${
                                          commission.status === 'paid' ? 'badge-success' :
                                          commission.status === 'pending' ? 'badge-warning' : 'badge-danger'
                                        }`}>
                                          {commission.status === 'paid' ? 'Pago' :
                                           commission.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-secondary-500">
                                        <div>{new Date(commission.created_at).toLocaleDateString('pt-BR')}</div>
                                        {commission.paid_at && (
                                          <div className="text-success-600">
                                            Pago: {new Date(commission.paid_at).toLocaleDateString('pt-BR')}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              {data.commissions.length === 0 && (
                                <div className="text-center py-8">
                                  <CurrencyDollarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                                  <p className="text-secondary-500">Nenhuma comissão encontrada</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-secondary-500">Erro ao carregar dados do gerente.</p>
                    <button
                      onClick={fetchManagerDetails}
                      className="btn btn-primary mt-4"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}