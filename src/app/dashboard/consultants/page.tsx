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
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'

interface Consultant {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  _count?: {
    leads: number
    commissions: number
  }
  manager?: {
    id: string
    full_name: string
  }
}

interface Manager {
  id: string
  full_name: string
  email: string
}

export default function ConsultantsPage() {
  const { profile } = useAuth()
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    manager_id: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile && (profile.role === 'clinic_admin' || profile.role === 'clinic_viewer' || profile.role === 'manager')) {
      fetchConsultants()
      if (profile.role !== 'manager') {
        fetchManagers()
      }
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

      // Buscar estatísticas de leads e comissões para cada consultor
      const consultantsWithStats = await Promise.all(
        (consultantsData || []).map(async (consultant) => {
          const [leadsCount, commissionsCount, managerData] = await Promise.all([
            supabase
              .from('leads')
              .select('id', { count: 'exact' })
              .eq('indicated_by', consultant.id),
            supabase
              .from('commissions')
              .select('id', { count: 'exact' })
              .eq('user_id', consultant.id)
              .eq('status', 'paid'),
            supabase
              .from('hierarchies')
              .select(`
                manager:manager_id (
                  id,
                  full_name
                )
              `)
              .eq('consultant_id', consultant.id)
              .single()
          ])

          return {
            ...consultant,
            _count: {
              leads: leadsCount.count || 0,
              commissions: commissionsCount.count || 0,
            },
            manager: managerData.data?.manager || null
          }
        })
      )

      setConsultants(consultantsWithStats)
    } catch (error: any) {
      console.error('Erro ao buscar consultores:', error)
      toast.error('Erro ao carregar consultores')
    } finally {
      setLoading(false)
    }
  }

  const fetchManagers = async () => {
    try {
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          user_clinics!inner(clinic_id)
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('role', 'manager')
        .eq('status', 'active')

      if (error) throw error
      setManagers(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar managers:', error)
    }
  }

  const handleCreateConsultant = async () => {
    try {
      setSubmitting(true)

      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) throw new Error('Clínica não encontrada')

      // Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          full_name: formData.full_name,
        }
      })

      if (authError) throw authError

      // Criar perfil do usuário
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: 'consultant',
          status: 'active',
        })

      if (profileError) throw profileError

      // Associar à clínica
      const { error: clinicError } = await supabase
        .from('user_clinics')
        .insert({
          user_id: authData.user.id,
          clinic_id: userClinic.clinic_id,
        })

      if (clinicError) throw clinicError

      // Se tem manager, criar hierarquia
      if (formData.manager_id) {
        const { error: hierarchyError } = await supabase
          .from('hierarchies')
          .insert({
            manager_id: formData.manager_id,
            consultant_id: authData.user.id,
            clinic_id: userClinic.clinic_id,
          })

        if (hierarchyError) throw hierarchyError
      }

      toast.success('Consultor criado com sucesso!')
      setIsModalOpen(false)
      setFormData({ full_name: '', email: '', phone: '', manager_id: '', password: '' })
      fetchConsultants()
    } catch (error: any) {
      console.error('Erro ao criar consultor:', error)
      toast.error(error.message || 'Erro ao criar consultor')
    } finally {
      setSubmitting(false)
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

      // Deletar usuário do auth
      const { error: authError } = await supabase.auth.admin.deleteUser(selectedConsultant.id)
      if (authError) throw authError

      toast.success('Consultor removido com sucesso!')
      setIsDeleteModalOpen(false)
      setSelectedConsultant(null)
      fetchConsultants()
    } catch (error: any) {
      console.error('Erro ao deletar consultor:', error)
      toast.error('Erro ao remover consultor')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredConsultants = consultants.filter(consultant => {
    const matchesSearch = !searchTerm ||
      consultant.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consultant.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || consultant.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: consultants.length,
    active: consultants.filter(c => c.status === 'active').length,
    inactive: consultants.filter(c => c.status === 'inactive').length,
    totalLeads: consultants.reduce((sum, c) => sum + (c._count?.leads || 0), 0),
  }

  const canEdit = profile?.role === 'clinic_admin'

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
            {profile?.role === 'manager' ? 'Minha Equipe' : 'Consultores'}
          </h1>
          <p className="text-secondary-600">
            {profile?.role === 'manager' 
              ? 'Gerencie sua equipe de consultores'
              : 'Gerencie todos os consultores da clínica'
            }
          </p>
        </div>
        
        {canEdit && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
          >
            <UserPlusIcon className="h-4 w-4 mr-2" />
            Novo Consultor
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Total</p>
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
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Ativos</p>
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
                <div className="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-danger-600">{stats.inactive}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Inativos</p>
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
                  <span className="text-sm font-bold text-primary-600">{stats.totalLeads}</span>
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-secondary-500">Total Leads</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar consultores..."
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
            
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
              }}
              className="btn btn-secondary"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Consultants Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Consultor</th>
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
                          <BuildingOfficeIcon className="h-4 w-4 text-secondary-400 mr-2" />
                          <span className="text-sm">{consultant.manager.full_name}</span>
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
                          <div className="text-xs text-secondary-500">Leads</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {consultant._count?.commissions || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Comissões</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={consultant.status}
                          onChange={(e) => handleStatusChange(consultant.id, e.target.value)}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs ${
                            consultant.status === 'active' ? 'badge-success' :
                            consultant.status === 'inactive' ? 'badge-danger' :
                            'badge-warning'
                          }`}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="pending">Pendente</option>
                        </select>
                      ) : (
                        <span className={`badge ${
                          consultant.status === 'active' ? 'badge-success' :
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
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Visualizar"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              className="btn btn-ghost btn-sm"
                              title="Editar"
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
                    onClick={() => setIsModalOpen(true)}
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
                    Novo Consultor
                  </Dialog.Title>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.full_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                        placeholder="Nome completo do consultor"
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
                        placeholder="email@exemplo.com"
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

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Senha Temporária
                      </label>
                      <input
                        type="password"
                        className="input"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>

                    {managers.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Gerente (Opcional)
                        </label>
                        <select
                          className="input"
                          value={formData.manager_id}
                          onChange={(e) => setFormData(prev => ({ ...prev, manager_id: e.target.value }))}
                        >
                          <option value="">Selecione um gerente</option>
                          {managers.map(manager => (
                            <option key={manager.id} value={manager.id}>
                              {manager.full_name}
                            </option>
                          ))}
                        </select>
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
                      onClick={handleCreateConsultant}
                      disabled={submitting || !formData.full_name || !formData.email || !formData.password}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Criando...
                        </>
                      ) : (
                        'Criar Consultor'
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
    </div>
  )
}