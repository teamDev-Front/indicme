// src/components/establishments/EstablishmentDetailModal.tsx - VERSÃO COMPLETA

import { EstablishmentCode } from "@/types"
import { Dialog, Transition } from "@headlessui/react"
import { 
  ChartBarIcon, 
  CurrencyDollarIcon, 
  UserGroupIcon, 
  UsersIcon, 
  XMarkIcon,
  TrophyIcon,
  StarIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  UserIcon
} from "@heroicons/react/24/outline"
import { createClient } from "@/utils/supabase/client"
import { Fragment, useEffect, useState } from "react"
import toast from 'react-hot-toast'

// Interfaces expandidas
interface DetailedLead {
  id: string
  full_name: string
  phone: string
  email?: string
  status: string
  arcadas_vendidas: number
  created_at: string
  converted_at?: string
  indicated_by: string
  consultant: {
    id: string
    full_name: string
    email: string
  }
  commissions?: Array<{
    id: string
    amount: number
    type: 'consultant' | 'manager'
    status: string
    user: {
      full_name: string
      role: string
    }
  }>
}

interface DetailedConsultant {
  id: string
  full_name: string
  email: string
  phone?: string
  role: string
  status: string
  leads_count: number
  converted_count: number
  total_arcadas: number
  total_commissions: number
  conversion_rate: number
  manager?: {
    id: string
    full_name: string
    email: string
  }
  recent_leads: DetailedLead[]
}

interface EstablishmentDetailData {
  consultants: DetailedConsultant[]
  managers: Array<{
    id: string
    full_name: string
    email: string
    phone?: string
    team_size: number
    team_arcadas: number
    team_commissions: number
    consultants: Array<{
      id: string
      full_name: string
      leads_count: number
      converted_count: number
    }>
  }>
  converted_leads: DetailedLead[]
  summary: {
    total_users: number
    total_leads: number
    total_converted: number
    total_arcadas: number
    total_commissions: number
    total_revenue: number
    conversion_rate: number
  }
}

interface EstablishmentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  establishment: EstablishmentCode | null
}

export function EstablishmentDetailModal({ isOpen, onClose, establishment }: EstablishmentDetailModalProps) {
  const [detailData, setDetailData] = useState<EstablishmentDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'consultants' | 'managers' | 'leads'>('overview')
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && establishment) {
      fetchCompleteDetailData()
    }
  }, [isOpen, establishment])

  const fetchCompleteDetailData = async () => {
    if (!establishment) return

    try {
      setLoading(true)
      console.log('📊 Buscando dados completos para:', establishment.name)

      // 1. Buscar todos os usuários do estabelecimento com hierarquia
      const { data: userEstablishments, error: usersError } = await supabase
        .from('user_establishments')
        .select(`
          user_id,
          users!user_establishments_user_id_fkey (
            id,
            full_name,
            email,
            phone,
            role,
            status
          )
        `)
        .eq('establishment_code', establishment.code)
        .eq('status', 'active')

      if (usersError) throw usersError

      // Correção de tipagem
      const allUsers = userEstablishments?.map(ue => ue.users).filter(Boolean) || []
      const consultants = allUsers.filter((u: any) => u?.role === 'consultant')
      const managers = allUsers.filter((u: any) => u?.role === 'manager')

      console.log('👥 Usuários encontrados:', { consultants: consultants.length, managers: managers.length })

      // 2. Buscar hierarquias para relacionar consultores com gerentes
      const consultantIds = consultants.map((c: any) => c.id)
      const managerIds = managers.map((m: any) => m.id)

      const { data: hierarchies } = await supabase
        .from('hierarchies')
        .select('manager_id, consultant_id')
        .in('consultant_id', consultantIds.length > 0 ? consultantIds : ['no-consultants'])

      // 3. Buscar todos os leads dos usuários do estabelecimento
      const allUserIds = allUsers.map((u: any) => u.id)
      const { data: allLeads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          full_name,
          phone,
          email,
          status,
          arcadas_vendidas,
          created_at,
          converted_at,
          indicated_by,
          establishment_code,
          users!leads_indicated_by_fkey (
            id,
            full_name,
            email,
            role
          )
        `)
        .in('indicated_by', allUserIds.length > 0 ? allUserIds : ['no-users'])
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError

      // 4. Buscar todas as comissões relacionadas
      const { data: allCommissions } = await supabase
        .from('commissions')
        .select(`
          id,
          amount,
          type,
          status,
          lead_id,
          user_id,
          users!commissions_user_id_fkey (
            full_name,
            role
          )
        `)
        .in('user_id', allUserIds.length > 0 ? allUserIds : ['no-users'])

      // 5. Processar dados dos consultores
      const detailedConsultants: DetailedConsultant[] = consultants.map((consultant: any) => {
        const consultantLeads = allLeads?.filter(l => l.indicated_by === consultant.id) || []
        const convertedLeads = consultantLeads.filter(l => l.status === 'converted')
        const totalArcadas = convertedLeads.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)
        
        const consultantCommissions = allCommissions?.filter(c => c.user_id === consultant.id) || []
        const totalCommissions = consultantCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)
        
        const conversionRate = consultantLeads.length > 0 
          ? (convertedLeads.length / consultantLeads.length) * 100 
          : 0

        // Encontrar gerente do consultor
        const hierarchy = hierarchies?.find(h => h.consultant_id === consultant.id)
        const manager = hierarchy ? managers.find((m: any) => m.id === hierarchy.manager_id) : undefined

        // Preparar leads detalhados
        const detailedLeads: DetailedLead[] = convertedLeads.map(lead => ({
          id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          email: lead.email || undefined,
          status: lead.status,
          arcadas_vendidas: lead.arcadas_vendidas || 1,
          created_at: lead.created_at,
          converted_at: lead.converted_at,
          indicated_by: lead.indicated_by,
          consultant: {
            id: consultant.id,
            full_name: consultant.full_name,
            email: consultant.email
          },
          commissions: allCommissions?.filter(c => c.lead_id === lead.id).map(c => ({
            id: c.id,
            amount: c.amount,
            type: c.type as 'consultant' | 'manager',
            status: c.status,
            user: {
              full_name: (c as any).users?.full_name || 'N/A',
              role: (c as any).users?.role || 'N/A'
            }
          }))
        }))

        return {
          id: consultant.id,
          full_name: consultant.full_name,
          email: consultant.email,
          phone: consultant.phone,
          role: consultant.role,
          status: consultant.status,
          leads_count: consultantLeads.length,
          converted_count: convertedLeads.length,
          total_arcadas: totalArcadas,
          total_commissions: totalCommissions,
          conversion_rate: conversionRate,
          manager: manager ? {
            id: (manager as any).id,
            full_name: (manager as any).full_name,
            email: (manager as any).email
          } : undefined,
          recent_leads: detailedLeads.slice(0, 5) // Últimos 5 convertidos
        }
      })

      // 6. Processar dados dos gerentes
      const detailedManagers = managers.map((manager: any) => {
        const teamConsultants = hierarchies?.filter(h => h.manager_id === manager.id).map(h => 
          consultants.find((c: any) => c.id === h.consultant_id)
        ).filter(Boolean) || []

        const teamLeads = allLeads?.filter(l => 
          teamConsultants.some((tc: any) => tc?.id === l.indicated_by) || l.indicated_by === manager.id
        ) || []

        const teamConverted = teamLeads.filter(l => l.status === 'converted')
        const teamArcadas = teamConverted.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)
        
        const managerCommissions = allCommissions?.filter(c => c.user_id === manager.id) || []
        const teamCommissions = managerCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)

        return {
          id: manager.id,
          full_name: manager.full_name,
          email: manager.email,
          phone: manager.phone,
          team_size: teamConsultants.length,
          team_arcadas: teamArcadas,
          team_commissions: teamCommissions,
          consultants: teamConsultants.map((tc: any) => {
            const tcLeads = allLeads?.filter(l => l.indicated_by === tc?.id) || []
            const tcConverted = tcLeads.filter(l => l.status === 'converted')
            return {
              id: tc?.id || '',
              full_name: tc?.full_name || '',
              leads_count: tcLeads.length,
              converted_count: tcConverted.length
            }
          })
        }
      })

      // 7. Processar todos os leads convertidos com detalhes
      const allConvertedLeads: DetailedLead[] = (allLeads?.filter(l => l.status === 'converted') || [])
        .map(lead => ({
          id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          email: lead.email || undefined,
          status: lead.status,
          arcadas_vendidas: lead.arcadas_vendidas || 1,
          created_at: lead.created_at,
          converted_at: lead.converted_at,
          indicated_by: lead.indicated_by,
          consultant: {
            id: (lead as any).users?.id || '',
            full_name: (lead as any).users?.full_name || 'N/A',
            email: (lead as any).users?.email || 'N/A'
          },
          commissions: allCommissions?.filter(c => c.lead_id === lead.id).map(c => ({
            id: c.id,
            amount: c.amount,
            type: c.type as 'consultant' | 'manager',
            status: c.status,
            user: {
              full_name: (c as any).users?.full_name || 'N/A',
              role: (c as any).users?.role || 'N/A'
            }
          }))
        }))

      // 8. Calcular resumo geral
      const totalLeads = allLeads?.length || 0
      const totalConverted = allConvertedLeads.length
      const totalArcadas = allConvertedLeads.reduce((sum, l) => sum + l.arcadas_vendidas, 0)
      const totalCommissions = allCommissions?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      
      // Buscar configurações para calcular receita
      const { data: settings } = await supabase
        .from('establishment_commissions')
        .select('consultant_value_per_arcada')
        .eq('establishment_code', establishment.code)
        .single()

      const valorPorArcada = settings?.consultant_value_per_arcada || 750
      const totalRevenue = totalArcadas * valorPorArcada

      const summary = {
        total_users: allUsers.length,
        total_leads: totalLeads,
        total_converted: totalConverted,
        total_arcadas: totalArcadas,
        total_commissions: totalCommissions,
        total_revenue: totalRevenue,
        conversion_rate: totalLeads > 0 ? (totalConverted / totalLeads) * 100 : 0
      }

      setDetailData({
        consultants: detailedConsultants,
        managers: detailedManagers,
        converted_leads: allConvertedLeads,
        summary
      })

      console.log('✅ Dados completos processados:', summary)

    } catch (error) {
      console.error('❌ Erro ao buscar dados completos:', error)
      toast.error('Erro ao carregar dados detalhados')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0 
    })
  }

  if (!establishment) return null

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
              <Dialog.Panel className="w-full max-w-7xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                    Relatório Detalhado - {establishment.name}
                    <span className="text-sm text-secondary-500 block">Código: {establishment.code}</span>
                  </Dialog.Title>
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
                    <span className="text-secondary-600">Carregando dados detalhados...</span>
                  </div>
                ) : detailData ? (
                  <div className="p-6">
                    {/* Tabs */}
                    <div className="border-b border-secondary-200 mb-6">
                      <nav className="-mb-px flex space-x-8">
                        {[
                          { id: 'overview', name: 'Visão Geral', icon: ChartBarIcon },
                          { id: 'consultants', name: 'Consultores', icon: UsersIcon },
                          { id: 'managers', name: 'Gerentes', icon: UserGroupIcon },
                          { id: 'leads', name: 'Leads Convertidos', icon: TrophyIcon }
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                              activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                            }`}
                          >
                            <tab.icon className="h-4 w-4 mr-2" />
                            {tab.name}
                          </button>
                        ))}
                      </nav>
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                      <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                              <UsersIcon className="h-5 w-5 mr-2" />
                              Leads ({detailData.summary.total_leads})
                            </h4>
                            <div className="space-y-1 text-sm text-blue-700">
                              <div>Convertidos: {detailData.summary.total_converted}</div>
                              <div>Taxa: {detailData.summary.conversion_rate.toFixed(1)}%</div>
                              <div className="font-medium text-blue-800">
                                Arcadas: {detailData.summary.total_arcadas}
                              </div>
                            </div>
                          </div>

                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="font-medium text-green-900 mb-2 flex items-center">
                              <UserGroupIcon className="h-5 w-5 mr-2" />
                              Equipe ({detailData.summary.total_users})
                            </h4>
                            <div className="space-y-1 text-sm text-green-700">
                              <div>Gerentes: {detailData.managers.length}</div>
                              <div>Consultores: {detailData.consultants.length}</div>
                              <div className="font-medium text-green-800">
                                Ativos: {detailData.consultants.filter(c => c.status === 'active').length}
                              </div>
                            </div>
                          </div>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                              <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                              Financeiro
                            </h4>
                            <div className="space-y-1 text-sm text-yellow-700">
                              <div>Receita: {formatCurrency(detailData.summary.total_revenue)}</div>
                              <div>Comissões: {formatCurrency(detailData.summary.total_commissions)}</div>
                              <div className="font-medium text-yellow-800">
                                Margem: {formatCurrency(detailData.summary.total_revenue - detailData.summary.total_commissions)}
                              </div>
                            </div>
                          </div>

                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                              <TrophyIcon className="h-5 w-5 mr-2" />
                              Performance
                            </h4>
                            <div className="space-y-1 text-sm text-purple-700">
                              <div>Ticket Médio: {formatCurrency(detailData.summary.total_revenue / (detailData.summary.total_converted || 1))}</div>
                              <div>Arcadas/Lead: {(detailData.summary.total_arcadas / (detailData.summary.total_converted || 1)).toFixed(1)}</div>
                              <div className="font-medium text-purple-800">
                                ROI: {((detailData.summary.total_revenue / (detailData.summary.total_commissions || 1)) * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Top Performers */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-white border border-secondary-200 rounded-lg p-4">
                            <h4 className="font-medium text-secondary-900 mb-4 flex items-center">
                              <StarIcon className="h-5 w-5 mr-2 text-yellow-500" />
                              Top Consultores
                            </h4>
                            <div className="space-y-3">
                              {detailData.consultants
                                .sort((a, b) => b.total_arcadas - a.total_arcadas)
                                .slice(0, 5)
                                .map((consultant, index) => (
                                <div key={consultant.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                  <div className="flex items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3 ${
                                      index === 0 ? 'bg-yellow-500' : 
                                      index === 1 ? 'bg-gray-400' : 
                                      index === 2 ? 'bg-yellow-600' : 'bg-primary-600'
                                    }`}>
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-medium text-secondary-900">{consultant.full_name}</div>
                                      <div className="text-sm text-secondary-500">
                                        {consultant.manager ? `Gerente: ${consultant.manager.full_name}` : 'Sem gerente'}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-secondary-900">{consultant.total_arcadas} arcadas</div>
                                    <div className="text-sm text-secondary-500">{consultant.conversion_rate.toFixed(1)}% conversão</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white border border-secondary-200 rounded-lg p-4">
                            <h4 className="font-medium text-secondary-900 mb-4 flex items-center">
                              <UserGroupIcon className="h-5 w-5 mr-2 text-green-500" />
                              Performance dos Gerentes
                            </h4>
                            <div className="space-y-3">
                              {detailData.managers
                                .sort((a, b) => b.team_arcadas - a.team_arcadas)
                                .map((manager) => (
                                <div key={manager.id} className="p-3 bg-secondary-50 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium text-secondary-900">{manager.full_name}</div>
                                    <div className="text-sm font-medium text-green-600">
                                      {manager.team_arcadas} arcadas
                                    </div>
                                  </div>
                                  <div className="text-sm text-secondary-600">
                                    Equipe: {manager.team_size} consultores • 
                                    Comissões: {formatCurrency(manager.team_commissions)}
                                  </div>
                                </div>
                              ))}
                              {detailData.managers.length === 0 && (
                                <div className="text-secondary-500 text-center py-4">
                                  Nenhum gerente encontrado
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Consultants Tab */}
                    {activeTab === 'consultants' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {detailData.consultants.map((consultant) => (
                            <div key={consultant.id} className="bg-white border border-secondary-200 rounded-lg p-6">
                              {/* Cabeçalho do Consultor */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                  <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium mr-4">
                                    {consultant.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-medium text-secondary-900">{consultant.full_name}</h3>
                                    <div className="flex items-center space-x-4 text-sm text-secondary-500">
                                      <span className="flex items-center">
                                        <EnvelopeIcon className="h-4 w-4 mr-1" />
                                        {consultant.email}
                                      </span>
                                      {consultant.phone && (
                                        <span className="flex items-center">
                                          <PhoneIcon className="h-4 w-4 mr-1" />
                                          {consultant.phone}
                                        </span>
                                      )}
                                    </div>
                                    {consultant.manager && (
                                      <div className="text-sm text-primary-600 mt-1">
                                        Gerente: {consultant.manager.full_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-primary-600">{consultant.total_arcadas}</div>
                                  <div className="text-sm text-secondary-500">arcadas vendidas</div>
                                </div>
                              </div>

                              {/* Métricas do Consultor */}
                              <div className="grid grid-cols-4 gap-4 mb-4">
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                  <div className="text-lg font-bold text-blue-600">{consultant.leads_count}</div>
                                  <div className="text-xs text-blue-600">Total Leads</div>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <div className="text-lg font-bold text-green-600">{consultant.converted_count}</div>
                                  <div className="text-xs text-green-600">Convertidos</div>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                  <div className="text-lg font-bold text-yellow-600">{consultant.conversion_rate.toFixed(1)}%</div>
                                  <div className="text-xs text-yellow-600">Taxa Conversão</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                  <div className="text-lg font-bold text-purple-600">{formatCurrency(consultant.total_commissions)}</div>
                                  <div className="text-xs text-purple-600">Comissões</div>
                                </div>
                              </div>

                              {/* Leads Recentes */}
                              {consultant.recent_leads.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-secondary-900 mb-3">Conversões Recentes</h4>
                                  <div className="space-y-2">
                                    {consultant.recent_leads.map((lead) => (
                                      <div key={lead.id} className="flex items-center justify-between p-2 bg-secondary-50 rounded">
                                        <div>
                                          <div className="text-sm font-medium text-secondary-900">{lead.full_name}</div>
                                          <div className="text-xs text-secondary-500">
                                            {formatDate(lead.converted_at || lead.created_at)} • {lead.phone}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-bold text-primary-600">
                                            {lead.arcadas_vendidas} arcada{lead.arcadas_vendidas > 1 ? 's' : ''}
                                          </div>
                                          <div className="text-xs text-secondary-500">
                                            {formatCurrency(lead.arcadas_vendidas * 750)}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {detailData.consultants.length === 0 && (
                            <div className="text-center py-12">
                              <UsersIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                              <h3 className="text-lg font-medium text-secondary-900 mb-2">Nenhum consultor encontrado</h3>
                              <p className="text-secondary-500">Este estabelecimento não possui consultores ativos.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Managers Tab */}
                    {activeTab === 'managers' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                          {detailData.managers.map((manager) => (
                            <div key={manager.id} className="bg-white border border-secondary-200 rounded-lg p-6">
                              {/* Cabeçalho do Gerente */}
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-medium mr-4">
                                    {manager.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-medium text-secondary-900">{manager.full_name}</h3>
                                    <div className="flex items-center space-x-4 text-sm text-secondary-500">
                                      <span className="flex items-center">
                                        <EnvelopeIcon className="h-4 w-4 mr-1" />
                                        {manager.email}
                                      </span>
                                      {manager.phone && (
                                        <span className="flex items-center">
                                          <PhoneIcon className="h-4 w-4 mr-1" />
                                          {manager.phone}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-green-600">{manager.team_arcadas}</div>
                                  <div className="text-sm text-secondary-500">arcadas da equipe</div>
                                </div>
                              </div>

                              {/* Métricas do Gerente */}
                              <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <div className="text-lg font-bold text-green-600">{manager.team_size}</div>
                                  <div className="text-xs text-green-600">Consultores</div>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                  <div className="text-lg font-bold text-blue-600">{manager.team_arcadas}</div>
                                  <div className="text-xs text-blue-600">Arcadas Equipe</div>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                  <div className="text-lg font-bold text-purple-600">{formatCurrency(manager.team_commissions)}</div>
                                  <div className="text-xs text-purple-600">Comissões</div>
                                </div>
                              </div>

                              {/* Equipe do Gerente */}
                              {manager.consultants.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-medium text-secondary-900 mb-3 flex items-center">
                                    <UserGroupIcon className="h-4 w-4 mr-2" />
                                    Equipe ({manager.consultants.length} consultores)
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {manager.consultants.map((consultant) => (
                                      <div key={consultant.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                        <div>
                                          <div className="text-sm font-medium text-secondary-900">{consultant.full_name}</div>
                                          <div className="text-xs text-secondary-500">
                                            {consultant.converted_count}/{consultant.leads_count} leads
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-bold text-primary-600">
                                            {consultant.converted_count} conv.
                                          </div>
                                          <div className="text-xs text-secondary-500">
                                            {consultant.leads_count > 0 ? ((consultant.converted_count / consultant.leads_count) * 100).toFixed(1) : 0}%
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {manager.consultants.length === 0 && (
                                <div className="text-center py-4 text-secondary-500">
                                  Este gerente ainda não possui consultores em sua equipe
                                </div>
                              )}
                            </div>
                          ))}

                          {detailData.managers.length === 0 && (
                            <div className="text-center py-12">
                              <UserGroupIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                              <h3 className="text-lg font-medium text-secondary-900 mb-2">Nenhum gerente encontrado</h3>
                              <p className="text-secondary-500">Este estabelecimento não possui gerentes ativos.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Leads Tab */}
                    {activeTab === 'leads' && (
                      <div className="space-y-6">
                        {/* Filtros rápidos */}
                        <div className="flex items-center space-x-4">
                          <div className="text-sm text-secondary-600">
                            Total: {detailData.converted_leads.length} leads convertidos
                          </div>
                          <div className="text-sm text-secondary-600">
                            Arcadas: {detailData.converted_leads.reduce((sum, l) => sum + l.arcadas_vendidas, 0)}
                          </div>
                        </div>

                        {/* Lista de Leads */}
                        <div className="space-y-4">
                          {detailData.converted_leads
                            .sort((a, b) => new Date(b.converted_at || b.created_at).getTime() - new Date(a.converted_at || a.created_at).getTime())
                            .map((lead) => (
                            <div key={lead.id} className="bg-white border border-secondary-200 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 bg-success-600 rounded-full flex items-center justify-center">
                                    <CheckCircleIcon className="h-5 w-5 text-white" />
                                  </div>
                                  <div>
                                    <h4 className="text-lg font-medium text-secondary-900">{lead.full_name}</h4>
                                    <div className="flex items-center space-x-4 text-sm text-secondary-500">
                                      <span className="flex items-center">
                                        <PhoneIcon className="h-3 w-3 mr-1" />
                                        {lead.phone}
                                      </span>
                                      {lead.email && (
                                        <span className="flex items-center">
                                          <EnvelopeIcon className="h-3 w-3 mr-1" />
                                          {lead.email}
                                        </span>
                                      )}
                                      <span className="flex items-center">
                                        <CalendarIcon className="h-3 w-3 mr-1" />
                                        Convertido em {formatDate(lead.converted_at || lead.created_at)}
                                      </span>
                                    </div>
                                    <div className="text-sm text-primary-600 mt-1">
                                      Indicado por: {lead.consultant.full_name}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-bold text-success-600">
                                    {lead.arcadas_vendidas} arcada{lead.arcadas_vendidas > 1 ? 's' : ''}
                                  </div>
                                  <div className="text-sm text-secondary-500">
                                    {lead.arcadas_vendidas === 1 ? 'Superior OU Inferior' : 'Superior E Inferior'}
                                  </div>
                                </div>
                              </div>

                              {/* Comissões do Lead */}
                              {lead.commissions && lead.commissions.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-secondary-200">
                                  <h5 className="text-sm font-medium text-secondary-900 mb-2">Comissões Geradas</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {lead.commissions.map((commission) => (
                                      <div key={commission.id} className="flex items-center justify-between p-2 bg-secondary-50 rounded">
                                        <div>
                                          <div className="text-sm font-medium text-secondary-900">
                                            {commission.user.full_name}
                                          </div>
                                          <div className="text-xs text-secondary-500">
                                            {commission.type === 'consultant' ? 'Consultor' : 'Gerente'} • 
                                            <span className={`ml-1 ${
                                              commission.status === 'paid' ? 'text-success-600' :
                                              commission.status === 'pending' ? 'text-warning-600' : 'text-danger-600'
                                            }`}>
                                              {commission.status === 'paid' ? 'Pago' :
                                               commission.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-sm font-bold text-success-600">
                                          {formatCurrency(commission.amount)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {detailData.converted_leads.length === 0 && (
                            <div className="text-center py-12">
                              <TrophyIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                              <h3 className="text-lg font-medium text-secondary-900 mb-2">Nenhum lead convertido</h3>
                              <p className="text-secondary-500">Este estabelecimento ainda não possui leads convertidos.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-secondary-500">Erro ao carregar dados do estabelecimento.</p>
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