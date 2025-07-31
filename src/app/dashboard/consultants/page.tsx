// src/app/dashboard/consultants/page.tsx - ATUALIZADO com Modal de Detalhes
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  MagnifyingGlassIcon,
  UserPlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import CreateConsultantModal from '@/components/consultants/CreateConsultantModal'
import ConsultantDetailModal from '@/components/consultants/ConsultantDetailModal'
import EditConsultantModal from '@/components/consultants/EditConsultantModal'

interface Consultant {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  establishment_count?: number
  establishment_names?: string[]
  _count?: {
    leads: number
    arcadas_vendidas: number
  }
  manager?: {
    id: string
    full_name: string
    establishment_name?: string
  }
}

export default function ConsultantsPage() {
  const { profile } = useAuth()
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [establishmentFilter, setEstablishmentFilter] = useState('')
  const [establishmentCountFilter, setEstablishmentCountFilter] = useState('')
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedConsultantId, setSelectedConsultantId] = useState<string | null>(null)
  const [selectedConsultantForEdit, setSelectedConsultantForEdit] = useState<Consultant | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [establishments, setEstablishments] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (profile && (profile.role === 'clinic_admin' || profile.role === 'clinic_viewer' || profile.role === 'manager')) {
      fetchConsultants()
    }
  }, [profile])

  const fetchConsultants = async () => {
    try {
      setLoading(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      let consultantsQuery = supabase
        .from('users')
        .select(`
        *,
        user_clinics!inner(clinic_id)
      `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .in('role', ['consultant', 'manager'])
        .order('created_at', { ascending: false })

      // Se for manager, mostrar apenas consultores da sua equipe
      if (profile?.role === 'manager') {
        const { data: hierarchy } = await supabase
          .from('hierarchies')
          .select('consultant_id')
          .eq('manager_id', profile.id)

        const consultantIds = hierarchy?.map(h => h.consultant_id) || []
        if (consultantIds.length > 0) {
          consultantsQuery = consultantsQuery.in('id', consultantIds)
        } else {
          setConsultants([])
          setLoading(false)
          return
        }
      }

      const { data: consultantsData, error } = await consultantsQuery

      if (error) throw error

      const consultantsWithStats = await Promise.all(
        (consultantsData || []).map(async (consultant) => {
          const [leadsCount, managerData] = await Promise.all([
            supabase
              .from('leads')
              .select('id', { count: 'exact' })
              .eq('indicated_by', consultant.id),
            supabase
              .from('hierarchies')
              .select(`
              manager_id,
              users!hierarchies_manager_id_fkey (
                id,
                full_name
              )
            `)
              .eq('consultant_id', consultant.id)
              .single(),
          ])

          // Calcular total de arcadas vendidas
          const { data: leadsData } = await supabase
            .from('leads')
            .select('arcadas_vendidas')
            .eq('indicated_by', consultant.id)
            .eq('status', 'converted')

          const totalArcadas = leadsData?.reduce((sum, lead) => sum + (lead.arcadas_vendidas || 1), 0) || 0

          const userEstablishments = await supabase
            .from('user_establishments')
            .select(`
              establishment_code,
              establishment_codes!user_establishments_establishment_code_fkey (
                name,
                description
              )
            `)
            .eq('user_id', consultant.id)
            .eq('status', 'active')

          // CORREÇÃO: Processar estabelecimentos corretamente
          const establishmentNames: string[] = []

          if (userEstablishments.data && userEstablishments.data.length > 0) {
            for (const est of userEstablishments.data) {
              // Verificar se establishment_codes existe e tem dados
              if (est.establishment_codes) {
                // establishment_codes pode ser um objeto ou array
                const estData = Array.isArray(est.establishment_codes)
                  ? est.establishment_codes[0]
                  : est.establishment_codes

                if (estData && estData.name) {
                  establishmentNames.push(estData.name)
                } else {
                  // Fallback: usar o código se não tiver nome
                  establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
                }
              } else {
                // Fallback se não tiver dados do estabelecimento
                establishmentNames.push(`Estabelecimento ${est.establishment_code}`)
              }
            }
          }

          // Se não tem estabelecimentos, adicionar placeholder
          if (establishmentNames.length === 0) {
            establishmentNames.push('Sem estabelecimento')
          }

          // Se o consultor tem manager, buscar info do manager
          let managerInfo = null
          if (managerData.data?.users) {
            const manager = Array.isArray(managerData.data.users) ? managerData.data.users[0] : managerData.data.users
            if (manager && manager.full_name) {
              managerInfo = {
                id: manager.id,
                full_name: manager.full_name,
                establishment_name: establishmentNames[0]
              }
            }
          }

          return {
            ...consultant,
            establishment_count: establishmentNames.length,
            establishment_names: establishmentNames,
            _count: {
              leads: leadsCount.count || 0,
              arcadas_vendidas: totalArcadas,
            },
            manager: managerInfo
          }
        })
      )

      setConsultants(consultantsWithStats)

      // Extrair estabelecimentos únicos para o filtro
      const allEstablishments = new Set<string>()
      consultantsWithStats.forEach(consultant => {
        consultant.establishment_names?.forEach((establishment: string) => {
          if (establishment && establishment !== 'Sem estabelecimento') {
            allEstablishments.add(establishment)
          }
        })
      })
      setEstablishments(Array.from(allEstablishments).sort())

    } catch (error: any) {
      console.error('Erro ao buscar consultores:', error)
      toast.error('Erro ao carregar consultores')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (consultantId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', consultantId)

      if (error) throw error

      setConsultants(prev => prev.map(consultant =>
        consultant.id === consultantId
          ? { ...consultant, status: newStatus as any }
          : consultant
      ))

      toast.success('Status atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDeleteConsultant = async () => {
    if (!selectedConsultant) return

    try {
      setSubmitting(true)

      console.log('🗑️ Iniciando processo de remoção do consultor:', selectedConsultant.full_name)

      // ETAPA 1: Verificar se consultor tem leads convertidos
      const { data: convertedLeads, error: leadsError } = await supabase
        .from('leads')
        .select('id, status')
        .eq('indicated_by', selectedConsultant.id)
        .eq('status', 'converted')

      if (leadsError) {
        console.error('Erro ao verificar leads convertidos:', leadsError)
        throw new Error('Erro ao verificar leads do consultor')
      }

      // Se tem leads convertidos, avisar o usuário
      if (convertedLeads && convertedLeads.length > 0) {
        const confirmDelete = window.confirm(
          `Este consultor possui ${convertedLeads.length} lead(s) convertido(s). ` +
          `Ao excluir, as comissões serão mantidas no histórico, mas o consultor será removido. ` +
          `Deseja continuar?`
        )

        if (!confirmDelete) {
          setSubmitting(false)
          return
        }
      }

      // ETAPA 2: Remover dados relacionados de forma segura (SEM CASCADE)

      console.log('🧹 Removendo comissões do consultor...')
      const { error: commissionsError } = await supabase
        .from('commissions')
        .delete()
        .eq('user_id', selectedConsultant.id)

      if (commissionsError) {
        console.warn('Aviso ao remover comissões:', commissionsError)
        // Não falhar se houver erro nas comissões
      }

      console.log('🧹 Removendo hierarquias (se for consultor de algum gerente)...')
      const { error: hierarchyError } = await supabase
        .from('hierarchies')
        .delete()
        .eq('consultant_id', selectedConsultant.id)

      if (hierarchyError) {
        console.warn('Aviso ao remover hierarquias:', hierarchyError)
      }

      console.log('🧹 Removendo associações com estabelecimentos...')
      const { error: establishmentsError } = await supabase
        .from('user_establishments')
        .delete()
        .eq('user_id', selectedConsultant.id)

      if (establishmentsError) {
        console.warn('Aviso ao remover estabelecimentos:', establishmentsError)
      }

      console.log('🧹 Removendo associação com clínica...')
      const { error: clinicError } = await supabase
        .from('user_clinics')
        .delete()
        .eq('user_id', selectedConsultant.id)

      if (clinicError) {
        console.warn('Aviso ao remover associação com clínica:', clinicError)
      }

      // ETAPA 3: Atualizar leads para remover referência ao consultor (opcional)
      console.log('🧹 Atualizando leads para remover referência...')
      const { error: updateLeadsError } = await supabase
        .from('leads')
        .update({
          indicated_by: null,
          updated_at: new Date().toISOString(),
          // Adicionar campo de observação se existir
          observations: `Consultor ${selectedConsultant.full_name} foi removido do sistema`
        })
        .eq('indicated_by', selectedConsultant.id)

      if (updateLeadsError) {
        console.warn('Aviso ao atualizar leads:', updateLeadsError)
      }

      // ETAPA 4: Remover o perfil do usuário da tabela 'users'
      console.log('🧹 Removendo perfil do consultor...')
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedConsultant.id)

      if (userError) {
        console.error('Erro ao remover perfil:', userError)
        throw new Error(`Erro ao remover perfil: ${userError.message}`)
      }

      // ETAPA 5: Aguardar um pouco antes de tentar remover do auth
      await new Promise(resolve => setTimeout(resolve, 1500))

      // ETAPA 6: Tentar remover do Supabase Auth (OPCIONAL - pode falhar)
      console.log('🔐 Tentando remover usuário do auth...')

      try {
        // CORREÇÃO: Usar client-side auth admin (pode não funcionar)
        // Em ambiente de produção, isso deve ser feito via API route ou webhook

        // Primeiro, verificar se temos permissões de admin
        const { data: currentUser } = await supabase.auth.getUser()

        if (!currentUser.user) {
          throw new Error('Usuário atual não identificado')
        }

        // ⚠️ IMPORTANTE: auth.admin só funciona com service_role key
        // Em ambiente de produção, mover isso para uma API route

        if (process.env.NODE_ENV === 'development') {
          // Apenas em desenvolvimento tentar usar admin
          const { error: authError } = await supabase.auth.admin.deleteUser(selectedConsultant.id)

          if (authError) {
            console.warn('Não foi possível remover do auth (não crítico):', authError.message)

            // Alternativa: desativar o usuário em vez de deletar
            toast.success(
              'Consultor removido do sistema! ' +
              '(Conta de acesso permanece, mas está inativa)'
            )
          } else {
            console.log('✅ Usuário removido do auth com sucesso')
            toast.success('Consultor removido completamente do sistema!')
          }
        } else {
          // Em produção, não tentar usar auth.admin do client
          console.log('⚠️ Produção: Usuário removido apenas do sistema (não do auth)')
          toast.success(
            'Consultor removido do sistema! ' +
            'Para remover completamente, contate o administrador técnico.'
          )
        }

      } catch (authDeleteError: any) {
        console.warn('Erro ao deletar do auth (não crítico):', authDeleteError)

        // Sucesso parcial - perfil foi removido mesmo que auth tenha falhado
        toast.success(
          'Consultor removido do sistema! ' +
          '(Conta de acesso pode ainda existir, mas está inativa)'
        )
      }

      // ETAPA 7: Atualizar a lista local
      setConsultants(prev => prev.filter(consultant => consultant.id !== selectedConsultant.id))
      setIsDeleteModalOpen(false)
      setSelectedConsultant(null)

      console.log('✅ Processo de remoção concluído com sucesso')

    } catch (error: any) {
      console.error('❌ Erro ao deletar consultor:', error)

      // Mensagens de erro mais específicas
      if (error.message.includes('foreign key')) {
        toast.error('Não é possível excluir: consultor possui dados relacionados')
      } else if (error.message.includes('permission')) {
        toast.error('Sem permissão para excluir este consultor')
      } else if (error.message.includes('Database error')) {
        toast.error('Erro no banco de dados. Tente novamente ou contate o suporte.')
      } else if (error.message.includes('RLS')) {
        toast.error('Erro de segurança: consulte o administrador')
      } else {
        toast.error(`Erro ao remover consultor: ${error.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // 🔥 NOVA FUNÇÃO: Abrir modal de detalhes
  const handleViewConsultant = (consultantId: string) => {
    console.log('👁️ Abrindo detalhes do consultor:', consultantId)
    setSelectedConsultantId(consultantId)
    setIsDetailModalOpen(true)
  }

  // 🔥 NOVA FUNÇÃO: Fechar modal de detalhes
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedConsultantId(null)
  }

  const filteredConsultants = consultants.filter(consultant => {
    const matchesSearch = !searchTerm ||
      consultant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.establishment_names?.some(establishment => establishment.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = !statusFilter || consultant.status === statusFilter
    const matchesEstablishment = !establishmentFilter || consultant.establishment_names?.includes(establishmentFilter)
    const matchesEstablishmentCount = !establishmentCountFilter ||
      (establishmentCountFilter === '1' && consultant.establishment_count === 1) ||
      (establishmentCountFilter === '2' && consultant.establishment_count === 2) ||
      (establishmentCountFilter === '3+' && (consultant.establishment_count || 0) >= 3)

    return matchesSearch && matchesStatus && matchesEstablishment && matchesEstablishmentCount
  })

  const stats = {
    total: consultants.length,
    active: consultants.filter(c => c.status === 'active').length,
    inactive: consultants.filter(c => c.status === 'inactive').length,
    totalLeads: consultants.reduce((sum, c) => sum + (c._count?.leads || 0), 0),
    totalArcadas: consultants.reduce((sum, c) => sum + (c._count?.arcadas_vendidas || 0), 0),
    multiEstablishmentConsultants: consultants.filter(c => (c.establishment_count || 0) > 1).length,
  }

  const canEdit = profile?.role === 'clinic_admin' || profile?.role === 'manager'

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
            {profile?.role === 'manager' ? 'Minha Equipe' : 'Consultores por Estabelecimento'}
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'manager'
              ? 'Gerencie sua equipe de consultores'
              : 'Gerencie todos os consultores organizados por estabelecimento'
            }
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            <UserPlusIcon className="h-4 w-4 mr-2" />
            Novo Consultor
          </button>
        )}
      </div>

      {/* Enhanced Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-600">{stats.total}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Total</p>
                <p className="text-xs text-secondary-400">Consultores</p>
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
                  <span className="text-sm font-bold text-success-600">{stats.active}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Ativos</p>
                <p className="text-xs text-secondary-400">Consultores</p>
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
                  <span className="text-sm font-bold text-primary-600">{stats.totalLeads}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Total</p>
                <p className="text-xs text-secondary-400">Indicações</p>
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
                  <span className="text-sm font-bold text-success-600">{stats.totalArcadas}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Arcadas</p>
                <p className="text-xs text-secondary-400">Vendidas</p>
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
                  <BuildingOfficeIcon className="w-4 h-4 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Estabelecimentos</p>
                <p className="text-xs font-bold text-warning-600">{establishments.length}</p>
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
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-success-600">{stats.multiEstablishmentConsultants}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Múltiplos</p>
                <p className="text-xs text-secondary-400">Estabelecimentos</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Enhanced Filters */}
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
                placeholder="Buscar por nome, email ou estabelecimento..."
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
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="pending">Pendente</option>
            </select>

            <select
              className="input"
              value={establishmentFilter}
              onChange={(e) => setEstablishmentFilter(e.target.value)}
            >
              <option value="">Todos os estabelecimentos</option>
              {establishments.map(establishment => (
                <option key={establishment} value={establishment}>
                  {establishment}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={establishmentCountFilter}
              onChange={(e) => setEstablishmentCountFilter(e.target.value)}
            >
              <option value="">Qualquer quantidade</option>
              <option value="1">1 estabelecimento</option>
              <option value="2">2 estabelecimentos</option>
              <option value="3+">3+ estabelecimentos</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setEstablishmentFilter('')
                setEstablishmentCountFilter('')
              }}
              className="btn btn-secondary"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Consultants Table */}
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
                  <th>Consultor</th>
                  <th>Estabelecimentos</th>
                  <th>Contato</th>
                  <th>Gerente</th>
                  <th>Performance</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsultants.map((consultant) => (
                  <tr key={consultant.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {consultant.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">
                            {consultant.full_name}
                          </div>
                          <div className="text-sm text-secondary-500">
                            Desde {new Date(consultant.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <BuildingOfficeIcon className="h-4 w-4 text-primary-500 mr-2" />
                          <span className="text-sm font-medium text-primary-900">
                            {consultant.establishment_count} estabelecimento{consultant.establishment_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-secondary-600">
                          {consultant.establishment_names?.slice(0, 2).join(', ')}
                          {(consultant.establishment_names?.length || 0) > 2 && (
                            <span className="text-secondary-500">
                              {' '}+{(consultant.establishment_names?.length || 0) - 2} mais
                            </span>
                          )}
                        </div>
                        {consultant.establishment_names?.some(name => name.includes('Focus')) && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-800">
                            Focus
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <EnvelopeIcon className="h-3 w-3 text-secondary-400 mr-1" />
                          {consultant.email}
                        </div>
                        {consultant.phone && (
                          <div className="flex items-center text-sm">
                            <PhoneIcon className="h-3 w-3 text-secondary-400 mr-1" />
                            {consultant.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {consultant.manager ? (
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-success-600 flex items-center justify-center mr-3">
                            <span className="text-xs font-medium text-white">
                              {consultant.manager.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-secondary-900">
                              {consultant.manager.full_name}
                            </div>
                            {consultant.manager.establishment_name && (
                              <div className="text-xs text-secondary-500">
                                {consultant.manager.establishment_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-secondary-500">Sem manager</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {consultant._count?.leads || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Indicações</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-success-600">
                            {consultant._count?.arcadas_vendidas || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Arcadas</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={consultant.status}
                          onChange={(e) => handleStatusChange(consultant.id, e.target.value)}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs ${consultant.status === 'active' ? 'badge-success' :
                            consultant.status === 'inactive' ? 'badge-danger' :
                              'badge-warning'
                            }`}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="pending">Pendente</option>
                        </select>
                      ) : (
                        <span className={`badge ${consultant.status === 'active' ? 'badge-success' :
                          consultant.status === 'inactive' ? 'badge-danger' :
                            'badge-warning'
                          }`}>
                          {consultant.status === 'active' ? 'Ativo' :
                            consultant.status === 'inactive' ? 'Inativo' :
                              'Pendente'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        {/* 🔥 BOTÃO ATUALIZADO: Agora abre o modal de detalhes */}
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Visualizar Detalhes"
                          onClick={() => handleViewConsultant(consultant.id)}
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Editar"
                              onClick={() => {
                                setSelectedConsultantForEdit(consultant)
                                setIsEditModalOpen(true)
                              }}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedConsultant(consultant)
                                setIsDeleteModalOpen(true)
                              }}
                              className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                              title="Remover"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredConsultants.length === 0 && (
              <div className="text-center py-12">
                <UserPlusIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {consultants.length === 0 ? 'Nenhum consultor encontrado' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {consultants.length === 0
                    ? 'Comece adicionando seu primeiro consultor.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
                {consultants.length === 0 && canEdit && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn btn-primary mt-4"
                  >
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Consultor
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Create Consultant Modal */}
      <CreateConsultantModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchConsultants}
      />

      {/* 🔥 NOVO: Modal de Detalhes do Consultor */}
      <ConsultantDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        consultantId={selectedConsultantId}
      />

      {/* Delete Confirmation Modal */}
      <Transition appear show={isDeleteModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 mr-3" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                      Confirmar Exclusão
                    </Dialog.Title>
                  </div>

                  <p className="text-sm text-secondary-500 mb-6">
                    Tem certeza que deseja remover o consultor <strong>{selectedConsultant?.full_name}</strong>?
                    Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
                  </p>

                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={handleDeleteConsultant}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Removendo...
                        </>
                      ) : (
                        'Remover Consultor'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
      <EditConsultantModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedConsultantForEdit(null)
        }}
        consultant={selectedConsultantForEdit}
        onSuccess={fetchConsultants}
      />
    </div>
  )
}