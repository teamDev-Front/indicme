// src/components/establishments/EstablishmentDetail.tsx - VERSÃO CORRIGIDA
import { EstablishmentCode } from "@/types"
import { Dialog, Transition } from "@headlessui/react"
import { ChartBarIcon, CurrencyDollarIcon, UserGroupIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { createClient } from "@/utils/supabase/client"  // CORREÇÃO: usar o cliente correto
import { Fragment, useEffect, useState } from "react"
import toast from 'react-hot-toast'

// Interface para os dados do modal
interface EstablishmentDetailData {
  leads: any[]
  users: any[]
  commissions: any[]
}

// Props do componente
interface EstablishmentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  establishment: EstablishmentCode | null
}

export function EstablishmentDetailModal({ isOpen, onClose, establishment }: EstablishmentDetailModalProps) {
  const [detailData, setDetailData] = useState<EstablishmentDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && establishment) {
      fetchDetailData()
    }
  }, [isOpen, establishment])

  const fetchDetailData = async () => {
    if (!establishment) return

    try {
      setLoading(true)
      console.log('📊 Buscando dados para estabelecimento:', establishment.name, 'código:', establishment.code)

      // 1. Buscar usuários do estabelecimento
      const { data: usersResult, error: usersError } = await supabase
        .from('user_establishments')
        .select(`
          *,
          users!inner (
            id,
            full_name,
            email,
            role,
            status
          )
        `)
        .eq('establishment_code', establishment.code)
        .eq('status', 'active')

      if (usersError) {
        console.error('Erro ao buscar usuários:', usersError)
      } else {
        console.log('✅ Usuários encontrados:', usersResult?.length || 0)
      }

      // 2. Buscar leads do estabelecimento
      const { data: leadsResult, error: leadsError } = await supabase
        .from('leads')
        .select(`
          *,
          users:indicated_by!inner (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('establishment_code', establishment.code)
        .order('created_at', { ascending: false })

      if (leadsError) {
        console.error('Erro ao buscar leads:', leadsError)
      } else {
        console.log('✅ Leads encontrados:', leadsResult?.length || 0)
      }

      // 3. Buscar comissões do estabelecimento
      const { data: commissionsResult, error: commissionsError } = await supabase
        .from('commissions')
        .select(`
          *,
          users!inner (
            id,
            full_name,
            email,
            role
          )
        `)
        .eq('establishment_code', establishment.code)
        .order('created_at', { ascending: false })

      if (commissionsError) {
        console.error('Erro ao buscar comissões:', commissionsError)
      } else {
        console.log('✅ Comissões encontradas:', commissionsResult?.length || 0)
      }

      // 4. Se não há dados diretos, buscar por usuários do estabelecimento
      let alternativeLeads = []
      let alternativeCommissions = []

      if (!leadsResult || leadsResult.length === 0) {
        console.log('🔄 Buscando leads alternativos...')
        
        const userIds = usersResult?.map(u => u.user_id) || []
        
        if (userIds.length > 0) {
          const { data: altLeads } = await supabase
            .from('leads')
            .select(`
              *,
              users:indicated_by!inner (
                id,
                full_name,
                email,
                role
              )
            `)
            .in('indicated_by', userIds)
            .order('created_at', { ascending: false })

          alternativeLeads = altLeads || []
          console.log('✅ Leads alternativos encontrados:', alternativeLeads.length)

          // Buscar comissões desses usuários
          const { data: altCommissions } = await supabase
            .from('commissions')
            .select(`
              *,
              users!inner (
                id,
                full_name,
                email,
                role
              )
            `)
            .in('user_id', userIds)
            .order('created_at', { ascending: false })

          alternativeCommissions = altCommissions || []
          console.log('✅ Comissões alternativas encontradas:', alternativeCommissions.length)
        }
      }

      // Usar dados diretos se disponíveis, senão usar alternativos
      const finalLeads = leadsResult && leadsResult.length > 0 ? leadsResult : alternativeLeads
      const finalCommissions = commissionsResult && commissionsResult.length > 0 ? commissionsResult : alternativeCommissions

      console.log('📊 Dados finais:', {
        users: usersResult?.length || 0,
        leads: finalLeads.length,
        commissions: finalCommissions.length
      })

      setDetailData({
        leads: finalLeads,
        users: usersResult || [],
        commissions: finalCommissions
      })

    } catch (error) {
      console.error('❌ Erro ao buscar detalhes:', error)
      toast.error('Erro ao carregar detalhes do estabelecimento')
      setDetailData({
        leads: [],
        users: [],
        commissions: []
      })
    } finally {
      setLoading(false)
    }
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
              <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
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
                    {/* Debug Info */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-900">Debug Info</h4>
                      <div className="text-xs text-blue-700 mt-1 grid grid-cols-3 gap-4">
                        <div>Usuários encontrados: {detailData.users?.length || 0}</div>
                        <div>Leads encontrados: {detailData.leads?.length || 0}</div>
                        <div>Comissões encontradas: {detailData.commissions?.length || 0}</div>
                      </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                          <UsersIcon className="h-5 w-5 mr-2" />
                          Leads ({detailData.leads?.length || 0})
                        </h4>
                        <div className="space-y-1 text-sm text-blue-700">
                          <div>Novos: {detailData.leads?.filter((l: any) => l.status === 'new').length || 0}</div>
                          <div>Contatados: {detailData.leads?.filter((l: any) => l.status === 'contacted').length || 0}</div>
                          <div>Convertidos: {detailData.leads?.filter((l: any) => l.status === 'converted').length || 0}</div>
                          <div>Perdidos: {detailData.leads?.filter((l: any) => l.status === 'lost').length || 0}</div>
                        </div>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2 flex items-center">
                          <UserGroupIcon className="h-5 w-5 mr-2" />
                          Equipe ({detailData.users?.length || 0})
                        </h4>
                        <div className="space-y-1 text-sm text-green-700">
                          <div>Gerentes: {detailData.users?.filter((u: any) => u.users?.role === 'manager').length || 0}</div>
                          <div>Consultores: {detailData.users?.filter((u: any) => u.users?.role === 'consultant').length || 0}</div>
                          <div>Conversão: {
                            detailData.leads?.length > 0
                              ? ((detailData.leads?.filter((l: any) => l.status === 'converted').length / detailData.leads?.length) * 100).toFixed(1)
                              : 0
                          }%</div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                          <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                          Financeiro
                        </h4>
                        <div className="space-y-1 text-sm text-yellow-700">
                          <div>Total Comissões: R$ {detailData.commissions?.reduce((sum: number, c: any) => sum + (c.amount || 0), 0).toLocaleString('pt-BR') || '0'}</div>
                          <div>Pagas: R$ {detailData.commissions?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + (c.amount || 0), 0).toLocaleString('pt-BR') || '0'}</div>
                          <div>Pendentes: R$ {detailData.commissions?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + (c.amount || 0), 0).toLocaleString('pt-BR') || '0'}</div>
                        </div>
                      </div>

                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                          <ChartBarIcon className="h-5 w-5 mr-2" />
                          Performance
                        </h4>
                        <div className="space-y-1 text-sm text-purple-700">
                          <div>Arcadas: {detailData.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0}</div>
                          <div>Receita: R$ {((detailData.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0) * 750).toLocaleString('pt-BR')}</div>
                          <div>Ticket Médio: R$ {
                            detailData.leads?.filter((l: any) => l.status === 'converted').length > 0
                              ? (((detailData.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0) * 750) / detailData.leads?.filter((l: any) => l.status === 'converted').length).toLocaleString('pt-BR')
                              : '0'
                          }</div>
                        </div>
                      </div>
                    </div>

                    {/* Listas detalhadas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Lista de Usuários */}
                      <div className="bg-white border border-secondary-200 rounded-lg p-4">
                        <h4 className="font-medium text-secondary-900 mb-4">Equipe do Estabelecimento</h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {detailData.users?.length > 0 ? (
                            detailData.users.map((userEst: any, index: number) => (
                              <div key={userEst.user_id || index} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                                    {userEst.users?.full_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <div className="font-medium text-secondary-900">{userEst.users?.full_name || 'Nome não disponível'}</div>
                                    <div className="text-sm text-secondary-500">{userEst.users?.email || 'Email não disponível'}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium capitalize">
                                    {userEst.users?.role === 'manager' ? 'Gerente' :
                                     userEst.users?.role === 'consultant' ? 'Consultor' :
                                     userEst.users?.role || 'Função não definida'}
                                  </div>
                                  <div className="text-xs text-secondary-500">
                                    Status: {userEst.users?.status || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-secondary-500 text-center py-4">Nenhum usuário vinculado</div>
                          )}
                        </div>
                      </div>

                      {/* Top Leads */}
                      <div className="bg-white border border-secondary-200 rounded-lg p-4">
                        <h4 className="font-medium text-secondary-900 mb-4">Leads Recentes</h4>
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {detailData.leads?.slice(0, 10).map((lead: any) => (
                            <div key={lead.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                              <div>
                                <div className="font-medium text-secondary-900">{lead.full_name}</div>
                                <div className="text-sm text-secondary-500">
                                  {lead.users?.full_name} • {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className={`text-sm px-2 py-1 rounded text-white ${
                                  lead.status === 'converted' ? 'bg-success-500' :
                                  lead.status === 'lost' ? 'bg-danger-500' :
                                  lead.status === 'contacted' ? 'bg-warning-500' : 'bg-primary-500'
                                }`}>
                                  {lead.status === 'converted' ? 'Convertido' :
                                   lead.status === 'lost' ? 'Perdido' :
                                   lead.status === 'contacted' ? 'Contatado' :
                                   lead.status === 'scheduled' ? 'Agendado' : 'Novo'}
                                </div>
                                {lead.status === 'converted' && (
                                  <div className="text-xs text-success-600 mt-1">
                                    {lead.arcadas_vendidas || 1} arcada{(lead.arcadas_vendidas || 1) > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          )) || <div className="text-secondary-500 text-center py-4">Nenhum lead encontrado</div>}
                        </div>
                      </div>
                    </div>

                    {/* Comissões se houver */}
                    {detailData.commissions && detailData.commissions.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium text-secondary-900 mb-4">Comissões Recentes</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {detailData.commissions.slice(0, 6).map((commission: any) => (
                            <div key={commission.id} className="p-4 bg-secondary-50 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-secondary-900">{commission.users?.full_name}</div>
                                <div className="text-sm font-medium text-success-600">
                                  R$ {commission.amount?.toLocaleString('pt-BR') || '0'}
                                </div>
                              </div>
                              <div className="text-sm text-secondary-500">
                                {commission.type === 'consultant' ? 'Consultor' : 'Gerente'} •
                                <span className={`ml-1 ${
                                  commission.status === 'paid' ? 'text-success-600' :
                                  commission.status === 'pending' ? 'text-warning-600' : 'text-danger-600'
                                }`}>
                                  {commission.status === 'paid' ? 'Pago' :
                                   commission.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                </span>
                              </div>
                              <div className="text-xs text-secondary-400 mt-1">
                                {new Date(commission.created_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          ))}
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