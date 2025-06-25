'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

interface Manager {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  gym_name?: string // Nova propriedade para academia
  _count?: {
    consultants: number
    leads: number
    commissions: number
  }
  _stats?: {
    totalCommissions: number
    conversionRate: number
  }
}

export default function ManagersPage() {
  const { profile } = useAuth()
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [gymFilter, setGymFilter] = useState('')
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    gym_name: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [gyms, setGyms] = useState<string[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (profile && (profile.role === 'clinic_admin' || profile.role === 'clinic_viewer')) {
      fetchManagers()
    }
  }, [profile])

  const fetchManagers = async () => {
    try {
      setLoading(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const { data: managersData, error } = await supabase
        .from('users')
        .select(`
          *,
          user_clinics!inner(clinic_id)
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('role', 'manager')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Buscar estatísticas para cada gerente
      const managersWithStats = await Promise.all(
        (managersData || []).map(async (manager) => {
          try {
            const [consultantsResult, leadsResult, commissionsResult] = await Promise.all([
              // Contar consultores sob este gerente
              supabase
                .from('hierarchies')
                .select('consultant_id', { count: 'exact' })
                .eq('manager_id', manager.id),

              // Contar leads usando a função SQL
              supabase.rpc('get_manager_leads_count', { manager_user_id: manager.id }),

              // Buscar comissões pagas deste gerente
              supabase
                .from('commissions')
                .select('amount, status')
                .eq('user_id', manager.id)
            ])

            // Verificar se os resultados são válidos
            const consultantsCount = consultantsResult?.count || 0
            const leadsCount = typeof leadsResult?.data === 'number' ? leadsResult.data : 0
            const commissionsData = commissionsResult?.data || []

            const totalCommissions = commissionsData
              .filter(c => c?.status === 'paid')
              .reduce((sum, c) => sum + (c?.amount || 0), 0)

            // Simular o campo gym_name baseado no nome do gerente (você pode adaptar isso)
            const gymName = manager.full_name.includes('Flex') ? 'Flex Academia' : 
                           manager.full_name.includes('Strong') ? 'Strong Fitness' :
                           manager.full_name.includes('Power') ? 'Power Gym' : 'Academia Central'

            return {
              ...manager,
              gym_name: gymName,
              _count: {
                consultants: consultantsCount,
                leads: leadsCount,
                commissions: commissionsData.filter(c => c?.status === 'paid').length,
              },
              _stats: {
                totalCommissions,
                conversionRate: 0, // Placeholder por enquanto
              }
            }
          } catch (statsError) {
            console.error('Erro ao buscar estatísticas para gerente:', manager.id, statsError)
            return {
              ...manager,
              gym_name: 'Academia não definida',
              _count: {
                consultants: 0,
                leads: 0,
                commissions: 0,
              },
              _stats: {
                totalCommissions: 0,
                conversionRate: 0,
              }
            }
          }
        })
      )

      setManagers(managersWithStats)

      // Extrair academias únicas para o filtro
      const uniqueGyms = Array.from(
        new Set(managersWithStats.map(m => m.gym_name).filter(Boolean))
      ).sort()
      setGyms(uniqueGyms)

    } catch (error: any) {
      console.error('Erro ao buscar gerentes:', error)
      toast.error('Erro ao carregar gerentes')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (mode: 'create' | 'edit', manager?: Manager) => {
    setModalMode(mode)
    if (mode === 'edit' && manager) {
      setSelectedManager(manager)
      setFormData({
        full_name: manager.full_name,
        email: manager.email,
        phone: manager.phone || '',
        gym_name: manager.gym_name || '',
        password: '', // Não mostrar senha existente
      })
    } else {
      setSelectedManager(null)
      setFormData({ full_name: '', email: '', phone: '', gym_name: '', password: '' })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) throw new Error('Clínica não encontrada')

      if (modalMode === 'create') {
        console.log('Criando gerente com dados:', formData)

        // 1. Fazer signup normal
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              gym_name: formData.gym_name,
            }
          }
        })

        if (signUpError) {
          throw new Error(`Erro no cadastro: ${signUpError.message}`)
        }

        if (signUpData.user) {
          // 2. Aguardar um pouco para garantir que o usuário foi criado
          await new Promise(resolve => setTimeout(resolve, 1000))

          // 3. Criar/atualizar perfil na tabela users
          const { error: upsertError } = await supabase
            .from('users')
            .upsert({
              id: signUpData.user.id,
              email: formData.email,
              full_name: formData.full_name,
              phone: formData.phone || null,
              role: 'manager',
              status: 'active',
              // Você pode adicionar um campo gym_name na tabela users
              // gym_name: formData.gym_name,
            }, {
              onConflict: 'id',
              ignoreDuplicates: false
            })

          if (upsertError) {
            throw new Error(`Erro ao criar perfil: ${upsertError.message}`)
          }

          // 4. Associar à clínica
          const { error: clinicError } = await supabase
            .from('user_clinics')
            .upsert({
              user_id: signUpData.user.id,
              clinic_id: userClinic.clinic_id,
            }, {
              onConflict: 'user_id,clinic_id',
              ignoreDuplicates: true
            })

          if (clinicError) {
            throw new Error(`Erro ao associar à clínica: ${clinicError.message}`)
          }

          toast.success('Gerente criado com sucesso! Ele receberá um email de confirmação.')
        } else {
          throw new Error('Usuário não foi criado corretamente')
        }

      } else {
        // EDIÇÃO
        if (!selectedManager) return

        const updateData: any = {
          full_name: formData.full_name,
          phone: formData.phone || null,
          // gym_name: formData.gym_name, // Se você adicionar este campo
          updated_at: new Date().toISOString()
        }

        const { error: profileError } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', selectedManager.id)

        if (profileError) throw profileError

        toast.success('Gerente atualizado com sucesso!')
      }

      setIsModalOpen(false)
      setFormData({ full_name: '', email: '', phone: '', gym_name: '', password: '' })

      // Aguardar um pouco antes de recarregar
      setTimeout(() => {
        fetchManagers()
      }, 1500)

    } catch (error: any) {
      console.error('Erro completo ao salvar gerente:', error)
      toast.error(error.message || 'Erro ao salvar gerente')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (managerId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', managerId)

      if (error) throw error

      setManagers(prev => prev.map(manager =>
        manager.id === managerId
          ? { ...manager, status: newStatus as any }
          : manager
      ))

      toast.success('Status atualizado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleDeleteManager = async () => {
    if (!selectedManager) return

    try {
      setSubmitting(true)

      // Verificar se o gerente tem consultores associados
      const { data: hierarchies, error: hierarchyError } = await supabase
        .from('hierarchies')
        .select('consultant_id')
        .eq('manager_id', selectedManager.id)

      if (hierarchyError) throw hierarchyError

      if (hierarchies && hierarchies.length > 0) {
        toast.error('Não é possível excluir um gerente que possui consultores associados. Remova os consultores primeiro.')
        return
      }

      // Deletar usuário do auth
      const { error: authError } = await supabase.auth.admin.deleteUser(selectedManager.id)
      if (authError) throw authError

      toast.success('Gerente removido com sucesso!')
      setIsDeleteModalOpen(false)
      setSelectedManager(null)
      fetchManagers()
    } catch (error: any) {
      console.error('Erro ao deletar gerente:', error)
      toast.error('Erro ao remover gerente')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredManagers = managers.filter(manager => {
    const matchesSearch = !searchTerm ||
      manager.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.gym_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || manager.status === statusFilter
    const matchesGym = !gymFilter || manager.gym_name === gymFilter

    return matchesSearch && matchesStatus && matchesGym
  })

  const stats = {
    total: managers.length,
    active: managers.filter(m => m.status === 'active').length,
    inactive: managers.filter(m => m.status === 'inactive').length,
    totalConsultants: managers.reduce((sum, m) => sum + (m._count?.consultants || 0), 0),
    totalCommissions: managers.reduce((sum, m) => sum + (m._stats?.totalCommissions || 0), 0),
    totalGyms: gyms.length,
  }

  const canEdit = profile?.role === 'clinic_admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (profile?.role !== 'clinic_admin' && profile?.role !== 'clinic_viewer') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
          <p className="text-secondary-500">
            Apenas administradores da clínica podem acessar esta página.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Gerentes por Academia</h1>
          <p className="text-secondary-600">
            Gerencie todos os gerentes da clínica organizados por academia
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => handleOpenModal('create')}
            className="btn btn-primary"
          >
            <UserPlusIcon className="h-4 w-4 mr-2" />
            Novo Gerente
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
                <p className="text-xs text-secondary-400">Gerentes</p>
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
                <p className="text-xs text-secondary-400">Gerentes</p>
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
                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                  <BuildingOfficeIcon className="w-4 h-4 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Academias</p>
                <p className="text-xs font-bold text-warning-600">{stats.totalGyms}</p>
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
                  <span className="text-sm font-bold text-primary-600">{stats.totalConsultants}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Consultores</p>
                <p className="text-xs text-secondary-400">Total</p>
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
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <CurrencyDollarIcon className="w-4 h-4 text-success-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Comissões</p>
                <p className="text-xs font-bold text-success-600">
                  R$ {stats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
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
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-primary-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Performance</p>
                <p className="text-xs font-bold text-primary-600">
                  {stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : 0}%
                </p>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar por nome, email ou academia..."
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
              value={gymFilter}
              onChange={(e) => setGymFilter(e.target.value)}
            >
              <option value="">Todas as academias</option>
              {gyms.map(gym => (
                <option key={gym} value={gym}>
                  {gym}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setGymFilter('')
              }}
              className="btn btn-secondary"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Managers Table */}
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
                  <th>Gerente</th>
                  <th>Academia</th>
                  <th>Contato</th>
                  <th>Equipe</th>
                  <th>Performance</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredManagers.map((manager) => (
                  <tr key={manager.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {manager.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">
                            {manager.full_name}
                          </div>
                          <div className="text-sm text-secondary-500">
                            Desde {new Date(manager.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="h-4 w-4 text-primary-500 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-primary-900">
                            {manager.gym_name || 'Não definida'}
                          </div>
                          <div className="text-xs text-secondary-500">
                            Academia responsável
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <EnvelopeIcon className="h-3 w-3 text-secondary-400 mr-1" />
                          {manager.email}
                        </div>
                        {manager.phone && (
                          <div className="flex items-center text-sm">
                            <PhoneIcon className="h-3 w-3 text-secondary-400 mr-1" />
                            {manager.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {manager._count?.consultants || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Consultores</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {manager._count?.leads || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Leads</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-success-600">
                          R$ {(manager._stats?.totalCommissions || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {manager._count?.commissions || 0} comissões pagas
                        </div>
                      </div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={manager.status}
                          onChange={(e) => handleStatusChange(manager.id, e.target.value)}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs ${
                            manager.status === 'active' ? 'badge-success' :
                            manager.status === 'inactive' ? 'badge-danger' :
                            'badge-warning'
                          }`}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="pending">Pendente</option>
                        </select>
                      ) : (
                        <span className={`badge ${
                          manager.status === 'active' ? 'badge-success' :
                          manager.status === 'inactive' ? 'badge-danger' :
                          'badge-warning'
                        }`}>
                          {manager.status === 'active' ? 'Ativo' :
                           manager.status === 'inactive' ? 'Inativo' :
                           'Pendente'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Visualizar"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenModal('edit', manager)}
                              className="btn btn-ghost btn-sm"
                              title="Editar"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedManager(manager)
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

            {filteredManagers.length === 0 && (
              <div className="text-center py-12">
                <BuildingOfficeIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {managers.length === 0 ? 'Nenhum gerente encontrado' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {managers.length === 0
                    ? 'Comece adicionando seu primeiro gerente.'
                    : 'Tente ajustar os filtros ou termo de busca.'
                  }
                </p>
                {managers.length === 0 && canEdit && (
                  <button
                    onClick={() => handleOpenModal('create')}
                    className="btn btn-primary mt-4"
                  >
                    <UserPlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Gerente
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Create/Edit Manager Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
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
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                    {modalMode === 'create' ? 'Novo Gerente' : 'Editar Gerente'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Nome
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Nome do gerente"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Academia
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.gym_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, gym_name: e.target.value }))}
                        placeholder="Ex: Flex Academia, Strong Fitness"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        className="input"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="email@academia.com"
                        disabled={modalMode === 'edit'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        className="input"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                      />
                    </div>

                    {modalMode === 'create' && (
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Senha
                        </label>
                        <input
                          type="password"
                          className="input"
                          value={formData.password}
                          onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="Mínimo 6 caracteres"
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={
                        submitting ||
                        !formData.full_name ||
                        !formData.email ||
                        !formData.gym_name ||
                        (modalMode === 'create' && !formData.password)
                      }
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          {modalMode === 'create' ? 'Criando...' : 'Salvando...'}
                        </>
                      ) : (
                        modalMode === 'create' ? 'Criar Gerente' : 'Salvar Alterações'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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
                    Tem certeza que deseja remover o gerente <strong>{selectedManager?.full_name}</strong>?
                    Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
                  </p>

                  <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-warning-700">
                      <strong>Atenção:</strong> Certifique-se de que este gerente não possui consultores associados antes de excluir.
                    </p>
                  </div>

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
                      onClick={handleDeleteManager}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Removendo...
                        </>
                      ) : (
                        'Remover Gerente'
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  )
}