import { EstablishmentCode } from "@/types"
import { Dialog, Transition } from "@headlessui/react"
import { ChartBarIcon, CurrencyDollarIcon, UserGroupIcon, UsersIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { createClient } from "@supabase/supabase-js"
import { Fragment, useEffect, useState } from "react"

// Componente do Modal de Detalhes do Estabelecimento
interface EstablishmentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  establishment: EstablishmentCode | null
}

function EstablishmentDetailModal({ isOpen, onClose, establishment }: EstablishmentDetailModalProps) {
  const [detailData, setDetailData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  useEffect(() => {
    if (isOpen && establishment) {
      fetchDetailData()
    }
  }, [isOpen, establishment])

  const fetchDetailData = async () => {
    if (!establishment) return

    try {
      setLoading(true)

      // Buscar dados detalhados
      const [leadsResult, usersResult, commissionsResult] = await Promise.all([
        supabase
          .from('leads')
          .select(`
            *,
            users:indicated_by (full_name, email, role)
          `)
          .eq('establishment_code', establishment.code)
          .order('created_at', { ascending: false }),
        supabase
          .from('user_establishments')
          .select(`
            *,
            users (full_name, email, role)
          `)
          .eq('establishment_code', establishment.code)
          .eq('status', 'active'),
        supabase
          .from('commissions')
          .select(`
            *,
            users (full_name, email, role)
          `)
          .eq('establishment_code', establishment.code)
          .order('created_at', { ascending: false })
      ])

      setDetailData({
        leads: leadsResult.data || [],
        users: usersResult.data || [],
        commissions: commissionsResult.data || []
      })
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error)
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
                    <div className="loading-spinner w-8 h-8"></div>
                  </div>
                ) : (
                  <div className="p-6">
                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                          <UsersIcon className="h-5 w-5 mr-2" />
                          Leads ({detailData?.leads?.length || 0})
                        </h4>
                        <div className="space-y-1 text-sm text-blue-700">
                          <div>Novos: {detailData?.leads?.filter((l: any) => l.status === 'new').length || 0}</div>
                          <div>Contatados: {detailData?.leads?.filter((l: any) => l.status === 'contacted').length || 0}</div>
                          <div>Convertidos: {detailData?.leads?.filter((l: any) => l.status === 'converted').length || 0}</div>
                          <div>Perdidos: {detailData?.leads?.filter((l: any) => l.status === 'lost').length || 0}</div>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-medium text-green-900 mb-2 flex items-center">
                          <UserGroupIcon className="h-5 w-5 mr-2" />
                          Equipe ({detailData?.users?.length || 0})
                        </h4>
                        <div className="space-y-1 text-sm text-green-700">
                          <div>Gerentes: {detailData?.users?.filter((u: any) => u.users?.role === 'manager').length || 0}</div>
                          <div>Consultores: {detailData?.users?.filter((u: any) => u.users?.role === 'consultant').length || 0}</div>
                          <div>Conversão: {
                            detailData?.leads?.length > 0 
                              ? ((detailData?.leads?.filter((l: any) => l.status === 'converted').length / detailData?.leads?.length) * 100).toFixed(1)
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
                          <div>Total Comissões: R$ {detailData?.commissions?.reduce((sum: number, c: any) => sum + c.amount, 0).toLocaleString('pt-BR') || '0'}</div>
                          <div>Pagas: R$ {detailData?.commissions?.filter((c: any) => c.status === 'paid').reduce((sum: number, c: any) => sum + c.amount, 0).toLocaleString('pt-BR') || '0'}</div>
                          <div>Pendentes: R$ {detailData?.commissions?.filter((c: any) => c.status === 'pending').reduce((sum: number, c: any) => sum + c.amount, 0).toLocaleString('pt-BR') || '0'}</div>
                        </div>
                      </div>

                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                          <ChartBarIcon className="h-5 w-5 mr-2" />
                          Performance
                        </h4>
                        <div className="space-y-1 text-sm text-purple-700">
                          <div>Arcadas: {detailData?.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0}</div>
                          <div>Receita: R$ {((detailData?.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0) * (establishment.commission_settings?.value_per_arcada || 750)).toLocaleString('pt-BR')}</div>
                          <div>Ticket Médio: R$ {
                            detailData?.leads?.filter((l: any) => l.status === 'converted').length > 0
                              ? (((detailData?.leads?.filter((l: any) => l.status === 'converted').reduce((sum: number, l: any) => sum + (l.arcadas_vendidas || 1), 0) || 0) * (establishment.commission_settings?.value_per_arcada || 750)) / detailData?.leads?.filter((l: any) => l.status === 'converted').length).toLocaleString('pt-BR')
                              : '0'
                          }</div>
                        </div>
                      </div>
                    </div>

                    {/* Top Performers */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-secondary-200 rounded-lg p-4">
                        <h4 className="font-medium text-secondary-900 mb-4">Top Consultores</h4>
                        <div className="space-y-3">
                          {detailData?.leads
                            ?.reduce((acc: any[], lead: any) => {
                              const existing = acc.find(item => item.consultant_id === lead.indicated_by)
                              if (existing) {
                                existing.leads_count++
                                if (lead.status === 'converted') existing.conversions++
                              } else {
                                acc.push({
                                  consultant_id: lead.indicated_by,
                                  consultant_name: lead.users?.full_name || 'Consultor',
                                  leads_count: 1,
                                  conversions: lead.status === 'converted' ? 1 : 0
                                })
                              }
                              return acc
                            }, [])
                            ?.sort((a: any, b: any) => b.conversions - a.conversions)
                            ?.slice(0, 5)
                            ?.map((consultant: any, index: number) => (
                              <div key={consultant.consultant_id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="font-medium text-secondary-900">{consultant.consultant_name}</div>
                                    <div className="text-sm text-secondary-500">{consultant.leads_count} leads</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-success-600">{consultant.conversions}</div>
                                  <div className="text-xs text-secondary-500">conversões</div>
                                </div>
                              </div>
                            )) || <div className="text-secondary-500 text-center py-4">Nenhum dado disponível</div>}
                        </div>
                      </div>

                      <div className="bg-white border border-secondary-200 rounded-lg p-4">
                        <h4 className="font-medium text-secondary-900 mb-4">Comissões Recentes</h4>
                        <div className="space-y-3">
                          {detailData?.commissions
                            ?.slice(0, 5)
                            ?.map((commission: any) => (
                              <div key={commission.id} className="flex items-center justify-between p-3 bg-secondary-50 rounded-lg">
                                <div>
                                  <div className="font-medium text-secondary-900">{commission.users?.full_name}</div>
                                  <div className="text-sm text-secondary-500">
                                    {commission.type === 'consultant' ? 'Consultor' : 'Gerente'} • {new Date(commission.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-medium text-success-600">R$ {commission.amount.toLocaleString('pt-BR')}</div>
                                  <div className={`text-xs ${
                                    commission.status === 'paid' ? 'text-success-600' :
                                    commission.status === 'pending' ? 'text-warning-600' : 'text-danger-600'
                                  }`}>
                                    {commission.status === 'paid' ? 'Pago' :
                                     commission.status === 'pending' ? 'Pendente' : 'Cancelado'}
                                  </div>
                                </div>
                              </div>
                            )) || <div className="text-secondary-500 text-center py-4">Nenhuma comissão encontrada</div>}
                        </div>
                      </div>
                    </div>
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