// src/components/consultants/ConsultantDetailModal.tsx
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
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

// Interfaces locais
interface EstablishmentCodeData {
  name: string
  description?: string
}

interface UserEstablishmentData {
  establishment_code: string
  establishment_codes: EstablishmentCodeData | EstablishmentCodeData[] | null
}

// Função utilitária local para processar estabelecimentos
function processEstablishmentNames(establishmentData: UserEstablishmentData[] | null): string[] {
  const establishmentNames: string[] = []

  if (!establishmentData || establishmentData.length === 0) {
    return ['Sem estabelecimento']
  }

  for (const est of establishmentData) {
    try {
      if (est.establishment_codes) {
        const estData = Array.isArray(est.establishment_codes)
          ? est.establishment_codes[0]
          : est.establishment_codes
        
        if (estData && typeof estData === 'object' && 'name' in estData && estData.name) {
          establishmentNames.push(estData.name)
        } else {
          establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
        }
      } else {
        establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
      }
    } catch (error) {
      console.warn('Erro ao processar estabelecimento:', est.establishment_code, error)
      establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
    }
  }

  if (establishmentNames.length === 0) {
    establishmentNames.push('Sem estabelecimento')
  }

  return establishmentNames
}

interface ConsultantDetailData {
  consultant: {
    id: string
    full_name: string
    email: string
    phone: string | null
    role: string
    status: string
    created_at: string
  }
  establishment_names: string[]
  leads: Array<{
    id: string
    full_name: string
    phone: string
    email: string | null
    status: string
    arcadas_vendidas: number | null
    created_at: string
    converted_at: string | null
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
  manager: {
    id: string
    full_name: string
    email: string
    commissions: Array<{
      id: string
      amount: number
      status: string
      arcadas_vendidas: number
      valor_por_arcada: number
      bonus_conquistados: number
      valor_bonus: number
      created_at: string
      paid_at: string | null
    }>
  } | null
  stats: {
    totalLeads: number
    convertedLeads: number
    pendingLeads: number
    lostLeads: number
    conversionRate: number
    totalArcadas: number
    totalCommissions: number
    paidCommissions: number
    pendingCommissions: number
    avgLeadsPerMonth: number
    managerTotalCommissions: number
    managerPaidCommissions: number
    managerPendingCommissions: number
  }
}

interface ConsultantDetailModalProps {
  isOpen: boolean
  onClose: () => void
  consultantId: string | null
}

export default function ConsultantDetailModal({
  isOpen,
  onClose,
  consultantId
}: ConsultantDetailModalProps) {
  const [data, setData] = useState<ConsultantDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'leads' | 'commissions' | 'manager'>('overview')
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && consultantId) {
      fetchConsultantDetails()
    }
  }, [isOpen, consultantId])

  const fetchConsultantDetails = async () => {
    if (!consultantId) return

    try {
      setLoading(true)
      console.log('📊 Buscando detalhes do consultor:', consultantId)

      // 1. Buscar dados básicos do consultor
      const { data: consultantInfo, error: consultantError } = await supabase
        .from('users')
        .select('*')
        .eq('id', consultantId)
        .single()

      if (consultantError) throw consultantError

      // 2. Buscar estabelecimentos do consultor
      const { data: establishmentData } = await supabase
        .from('user_establishments')
        .select(`
          establishment_code,
          establishment_codes!user_establishments_establishment_code_fkey (
            name,
            description
          )
        `)
        .eq('user_id', consultantId)
        .eq('status', 'active')

      // Usar função utilitária para processar estabelecimentos
      const establishmentNames = processEstablishmentNames(establishmentData)

      // 3. Buscar leads do consultor
      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('indicated_by', consultantId)
        .order('created_at', { ascending: false })

      // 4. Buscar comissões do consultor
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select('*')
        .eq('user_id', consultantId)
        .order('created_at', { ascending: false })

      // 5. Buscar gerente e suas comissões relacionadas
      const { data: hierarchyData } = await supabase
        .from('hierarchies')
        .select(`
          manager_id,
          users!hierarchies_manager_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('consultant_id', consultantId)
        .single()

      let managerData = null
      if (hierarchyData?.users) {
        const manager = Array.isArray(hierarchyData.users) 
          ? hierarchyData.users[0] 
          : hierarchyData.users

        // Buscar comissões do gerente relacionadas às vendas deste consultor
        const { data: managerCommissions } = await supabase
          .from('commissions')
          .select('*')
          .eq('user_id', manager.id)
          .eq('type', 'manager')
          .order('created_at', { ascending: false })
          .limit(10)

        managerData = {
          id: manager.id,
          full_name: manager.full_name,
          email: manager.email,
          commissions: managerCommissions || []
        }
      }

      // 6. Calcular estatísticas
      const totalLeads = leadsData?.length || 0
      const convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
      const pendingLeads = leadsData?.filter(l => 
        ['new', 'contacted', 'scheduled'].includes(l.status)
      ).length || 0
      const lostLeads = leadsData?.filter(l => l.status === 'lost').length || 0
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

      const totalArcadas = leadsData?.filter(l => l.status === 'converted')
        .reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0

      const totalCommissions = commissionsData?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const paidCommissions = commissionsData?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const pendingCommissions = commissionsData?.filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      const membershipMonths = Math.max(1, Math.floor(
        (new Date().getTime() - new Date(consultantInfo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
      ))
      const avgLeadsPerMonth = totalLeads / membershipMonths

      // Estatísticas do gerente
      const managerTotalCommissions = managerData?.commissions.reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const managerPaidCommissions = managerData?.commissions.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0
      const managerPendingCommissions = managerData?.commissions.filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      setData({
        consultant: consultantInfo,
        establishment_names: establishmentNames,
        leads: leadsData || [],
        commissions: commissionsData || [],
        manager: managerData,
        stats: {
          totalLeads,
          convertedLeads,
          pendingLeads,
          lostLeads,
          conversionRate,
          totalArcadas,
          totalCommissions,
          paidCommissions,
          pendingCommissions,
          avgLeadsPerMonth,
          managerTotalCommissions,
          managerPaidCommissions,
          managerPendingCommissions,
        }
      })

      console.log('✅ Dados do consultor carregados')

    } catch (error: any) {
      console.error('❌ Erro ao buscar detalhes do consultor:', error)
      toast.error('Erro ao carregar detalhes do consultor')
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

  if (!consultantId) return null

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
                    <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-white">
                        {data?.consultant.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                        {data?.consultant.full_name || 'Carregando...'}
                      </Dialog.Title>
                      <p className="text-sm text-secondary-500">
                        {data?.consultant.email} • {data?.establishment_names.join(', ')}
                      </p>
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
                              ? 'border-primary-500 text-primary-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Visão Geral
                        </button>
                        <button
                          onClick={() => setActiveTab('leads')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'leads'
                              ? 'border-primary-500 text-primary-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Leads ({data.stats.totalLeads})
                        </button>
                        <button
                          onClick={() => setActiveTab('commissions')}
                          className={`py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'commissions'
                              ? 'border-primary-500 text-primary-600'
                              : 'border-transparent text-secondary-500 hover:text-secondary-700'
                          }`}
                        >
                          Comissões ({data.commissions.length})
                        </button>
                        {data.manager && (
                          <button
                            onClick={() => setActiveTab('manager')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                              activeTab === 'manager'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-secondary-500 hover:text-secondary-700'
                            }`}
                          >
                            Gerente
                          </button>
                        )}
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeTab === 'overview' && (
                        <div className="space-y-6">
                          {/* Performance Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <UserIcon className="h-8 w-8 text-primary-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-primary-900">{data.stats.totalLeads}</div>
                                  <div className="text-sm text-primary-700">Total de Leads</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <CheckCircleIcon className="h-8 w-8 text-success-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-success-900">{data.stats.convertedLeads}</div>
                                  <div className="text-sm text-success-700">Convertidos</div>
                                  <div className="text-xs text-success-600">{data.stats.conversionRate.toFixed(1)}% conversão</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <TrophyIcon className="h-8 w-8 text-purple-600 mr-3" />
                                <div>
                                  <div className="text-2xl font-bold text-purple-900">{data.stats.totalArcadas}</div>
                                  <div className="text-sm text-purple-700">Arcadas Vendidas</div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                              <div className="flex items-center">
                                <CurrencyDollarIcon className="h-8 w-8 text-warning-600 mr-3" />
                                <div>
                                  <div className="text-lg font-bold text-warning-900">
                                    R$ {data.stats.paidCommissions.toLocaleString('pt-BR')}
                                  </div>
                                  <div className="text-sm text-warning-700">Comissões Pagas</div>
                                  <div className="text-xs text-warning-600">
                                    R$ {data.stats.pendingCommissions.toLocaleString('pt-BR')} pendente
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Informações Pessoais */}
                          <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-6">
                            <h4 className="text-lg font-medium text-secondary-900 mb-4">Informações Pessoais</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <div className="flex items-center">
                                  <EnvelopeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">{data.consultant.email}</div>
                                    <div className="text-sm text-secondary-500">Email</div>
                                  </div>
                                </div>

                                {data.consultant.phone && (
                                  <div className="flex items-center">
                                    <PhoneIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                    <div>
                                      <div className="font-medium text-secondary-900">{data.consultant.phone}</div>
                                      <div className="text-sm text-secondary-500">Telefone</div>
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-center">
                                  <BuildingOfficeIcon className="h-5 w-5 text-secondary-400 mr-3" />
                                  <div>
                                    <div className="font-medium text-secondary-900">
                                      {data.establishment_names.join(', ') || 'Nenhum'}
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
                                      {new Date(data.consultant.created_at).toLocaleDateString('pt-BR')}
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
                                    <div className="text-sm text-secondary-500">Média mensal</div>
                                  </div>
                                </div>

                                <div className="flex items-center">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    data.consultant.status === 'active' 
                                      ? 'bg-success-100 text-success-800'
                                      : 'bg-danger-100 text-danger-800'
                                  }`}>
                                    {data.consultant.status === 'active' ? 'Ativo' : 'Inativo'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Breakdown de Performance */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white border border-secondary-200 rounded-lg p-6">
                              <h4 className="text-lg font-medium text-secondary-900 mb-4">Distribuição de Leads</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Convertidos</span>
                                  <div className="flex items-center">
                                    <div className="w-24 bg-secondary-200 rounded-full h-2 mr-3">
                                      <div 
                                        className="bg-success-600 h-2 rounded-full" 
                                        style={{ width: `${data.stats.conversionRate}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium">{data.stats.convertedLeads}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Pendentes</span>
                                  <div className="flex items-center">
                                    <div className="w-24 bg-secondary-200 rounded-full h-2 mr-3">
                                      <div 
                                        className="bg-warning-600 h-2 rounded-full" 
                                        style={{ width: `${(data.stats.pendingLeads / data.stats.totalLeads) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium">{data.stats.pendingLeads}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Perdidos</span>
                                  <div className="flex items-center">
                                    <div className="w-24 bg-secondary-200 rounded-full h-2 mr-3">
                                      <div 
                                        className="bg-danger-600 h-2 rounded-full" 
                                        style={{ width: `${(data.stats.lostLeads / data.stats.totalLeads) * 100}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium">{data.stats.lostLeads}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white border border-secondary-200 rounded-lg p-6">
                              <h4 className="text-lg font-medium text-secondary-900 mb-4">Status de Comissões</h4>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Pagas</span>
                                  <div className="flex items-center">
                                    <span className="text-lg font-bold text-success-600 mr-2">
                                      R$ {data.stats.paidCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-secondary-600">Pendentes</span>
                                  <div className="flex items-center">
                                    <span className="text-lg font-bold text-warning-600 mr-2">
                                      R$ {data.stats.pendingCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                                <div className="pt-2 border-t">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-secondary-900">Total</span>
                                    <span className="text-xl font-bold text-primary-600">
                                      R$ {data.stats.totalCommissions.toLocaleString('pt-BR')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'leads' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-medium text-secondary-900">
                              Leads do Consultor ({data.leads.length})
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
                                  {data.leads.map((lead) => (
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
                                  <UserIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                                  <p className="text-secondary-500">Nenhum lead encontrado</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'commissions' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h4 className="text-lg font-medium text-secondary-900">
                              Comissões do Consultor ({data.commissions.length})
                            </h4>
                            <div className="text-sm text-secondary-600">
                              Total: R$ {data.stats.totalCommissions.toLocaleString('pt-BR')}
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
                                        <div className="font-bold text-lg text-primary-600">
                                          R$ {commission.amount.toLocaleString('pt-BR')}
                                        </div>
                                        <div className="text-xs text-secondary-500">
                                          R$ {commission.valor_por_arcada.toLocaleString('pt-BR')}/arcada
                                        </div>
                                      </td>
                                      <td className="px-6 py-4">
                                        <span className={`badge ${commission.type === 'consultant' ? 'badge-primary' : 'badge-secondary'}`}>
                                          {commission.type === 'consultant' ? 'Consultor' : 'Gerente'}
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

                      {activeTab === 'manager' && data.manager && (
                        <div className="space-y-6">
                          {/* Info do Gerente */}
                          <div className="bg-success-50 border border-success-200 rounded-lg p-6">
                            <div className="flex items-center space-x-4 mb-4">
                              <div className="w-12 h-12 bg-success-600 rounded-full flex items-center justify-center">
                                <span className="text-lg font-medium text-white">
                                  {data.manager.full_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h4 className="text-lg font-medium text-success-900">{data.manager.full_name}</h4>
                                <p className="text-sm text-success-700">{data.manager.email}</p>
                                <p className="text-sm text-success-600">Gerente responsável</p>
                              </div>
                            </div>

                            {/* Stats do Gerente */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center">
                                  <CurrencyDollarIcon className="h-8 w-8 text-success-600 mr-3" />
                                  <div>
                                    <div className="text-xl font-bold text-success-900">
                                      R$ {data.stats.managerTotalCommissions.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-success-700">Total Comissões</div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center">
                                  <CheckCircleIcon className="h-8 w-8 text-success-600 mr-3" />
                                  <div>
                                    <div className="text-xl font-bold text-success-900">
                                      R$ {data.stats.managerPaidCommissions.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-success-700">Pagas</div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center">
                                  <ClockIcon className="h-8 w-8 text-warning-600 mr-3" />
                                  <div>
                                    <div className="text-xl font-bold text-warning-900">
                                      R$ {data.stats.managerPendingCommissions.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="text-sm text-warning-700">Pendentes</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Comissões do Gerente */}
                          <div>
                            <h5 className="text-lg font-medium text-secondary-900 mb-4">
                              Comissões do Gerente ({data.manager.commissions.length})
                            </h5>

                            <div className="bg-white border border-secondary-200 rounded-lg overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-secondary-200">
                                  <thead className="bg-secondary-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase">
                                        Valor
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
                                    {data.manager.commissions.map((commission) => (
                                      <tr key={commission.id} className="hover:bg-secondary-50">
                                        <td className="px-6 py-4">
                                          <div className="font-bold text-lg text-success-600">
                                            R$ {commission.amount.toLocaleString('pt-BR')}
                                          </div>
                                          <div className="text-xs text-secondary-500">
                                            R$ {commission.valor_por_arcada.toLocaleString('pt-BR')}/arcada base
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          <div className="flex items-center">
                                            <TrophyIcon className="h-4 w-4 text-warning-500 mr-1" />
                                            <span className="font-medium">{commission.arcadas_vendidas}</span>
                                          </div>
                                        </td>
                                        <td className="px-6 py-4">
                                          {commission.valor_bonus > 0 ? (
                                            <div>
                                              <div className="font-medium text-warning-600">
                                                R$ {commission.valor_bonus.toLocaleString('pt-BR')}
                                              </div>
                                              <div className="text-xs text-warning-500">
                                                Bônus de marcos
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

                                {data.manager.commissions.length === 0 && (
                                  <div className="text-center py-8">
                                    <UserGroupIcon className="mx-auto h-12 w-12 text-secondary-400 mb-3" />
                                    <p className="text-secondary-500">Nenhuma comissão de gerente encontrada</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-secondary-500">Erro ao carregar dados do consultor.</p>
                    <button
                      onClick={fetchConsultantDetails}
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