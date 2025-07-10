// src/app/dashboard/establishments/page.tsx - VERSÃO CORRIGIDA
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  BuildingOfficeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  CogIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import CommissionSettingsModal from '@/components/establishments/ComissionSettingsModal'

interface EstablishmentCode {
  id: string
  code: string
  name: string
  description?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at: string
  _stats?: {
    users_count: number
    leads_count: number
    total_revenue: number
    total_commissions: number
    converted_leads: number
  }
  _commission_settings?: {
    consultant_value_per_arcada: number
    manager_bonus_35_arcadas: number
    manager_bonus_50_arcadas: number
    manager_bonus_75_arcadas: number
  }
}

interface EstablishmentDetailData {
  leads: any[]
  users: any[]
  commissions: any[]
}

export default function EstablishmentsPage() {
  const { profile } = useAuth()
  const [establishments, setEstablishments] = useState<EstablishmentCode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentCode | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [detailData, setDetailData] = useState<EstablishmentDetailData | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
  })
  const [commissionData, setCommissionData] = useState({
    consultant_value_per_arcada: 750,
    consultant_bonus_every_arcadas: 7,
    consultant_bonus_value: 750,
    manager_bonus_35_arcadas: 5000,
    manager_bonus_50_arcadas: 10000,
    manager_bonus_75_arcadas: 15000,
  })
  const supabase = createClient()

  useEffect(() => {
    if (profile && profile.role === 'clinic_admin') {
      fetchEstablishments()
    }
  }, [profile])

  const fetchEstablishments = async () => {
    try {
      setLoading(true)

      const { data: establishmentsData, error } = await supabase
        .from('establishment_codes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Buscar estatísticas e configurações para cada estabelecimento
      const establishmentsWithStats = await Promise.all(
        (establishmentsData || []).map(async (establishment) => {
          const [usersResult, leadsResult, commissionsResult, settingsResult] = await Promise.all([
            supabase
              .from('user_establishments')
              .select('user_id', { count: 'exact' })
              .eq('establishment_code', establishment.code)
              .eq('status', 'active'),
            supabase
              .from('leads')
              .select('id, status, arcadas_vendidas')
              .eq('establishment_code', establishment.code),
            supabase
              .from('commissions')
              .select('amount, status')
              .eq('establishment_code', establishment.code),
            supabase
              .from('establishment_commissions')
              .select('*')
              .eq('establishment_code', establishment.code)
              .single()
          ])

          // Calcular estatísticas
          const leads = leadsResult.data || []
          const commissions = commissionsResult.data || []
          const convertedLeads = leads.filter(l => l.status === 'converted')
          const totalArcadas = convertedLeads.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)
          
          // Usar configuração específica ou padrão
          const commissionSettings = settingsResult.data || {
            consultant_value_per_arcada: 750,
            manager_bonus_35_arcadas: 5000,
            manager_bonus_50_arcadas: 10000,
            manager_bonus_75_arcadas: 15000,
          }

          const totalRevenue = totalArcadas * commissionSettings.consultant_value_per_arcada
          const totalCommissions = commissions.reduce((sum, c) => sum + c.amount, 0)

          return {
            ...establishment,
            _stats: {
              users_count: usersResult.count || 0,
              leads_count: leads.length,
              total_revenue: totalRevenue,
              total_commissions: totalCommissions,
              converted_leads: convertedLeads.length,
            },
            _commission_settings: commissionSettings
          }
        })
      )

      setEstablishments(establishmentsWithStats)
    } catch (error: any) {
      console.error('Erro ao buscar estabelecimentos:', error)
      toast.error('Erro ao carregar estabelecimentos')
    } finally {
      setLoading(false)
    }
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code: result }))
  }

  const handleOpenModal = (mode: 'create' | 'edit', establishment?: EstablishmentCode) => {
    setModalMode(mode)
    if (mode === 'edit' && establishment) {
      setSelectedEstablishment(establishment)
      setFormData({
        code: establishment.code,
        name: establishment.name,
        description: establishment.description || '',
        address: establishment.address || '',
        city: establishment.city || '',
        state: establishment.state || '',
        phone: establishment.phone || '',
        email: establishment.email || '',
      })
    } else {
      setSelectedEstablishment(null)
      setFormData({
        code: '',
        name: '',
        description: '',
        address: '',
        city: '',
        state: '',
        phone: '',
        email: '',
      })
      setCommissionData({
        consultant_value_per_arcada: 750,
        consultant_bonus_every_arcadas: 7,
        consultant_bonus_value: 750,
        manager_bonus_35_arcadas: 5000,
        manager_bonus_50_arcadas: 10000,
        manager_bonus_75_arcadas: 15000,
      })
      if (mode === 'create') {
        generateCode()
      }
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      if (modalMode === 'create') {
        // Verificar se código já existe
        const { data: existing } = await supabase
          .from('establishment_codes')
          .select('id')
          .eq('code', formData.code.toUpperCase())
          .single()

        if (existing) {
          toast.error('Código já existe. Gere um novo código.')
          return
        }

        const { error } = await supabase
          .from('establishment_codes')
          .insert({
            code: formData.code.toUpperCase(),
            name: formData.name,
            description: formData.description || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null,
            email: formData.email || null,
            is_active: true,
          })

        if (error) throw error
        
        // Se for criação, criar também as configurações de comissão
        if (modalMode === 'create') {
          const { error: commissionError } = await supabase
            .from('establishment_commissions')
            .insert({
              establishment_code: formData.code.toUpperCase(),
              consultant_value_per_arcada: commissionData.consultant_value_per_arcada,
              consultant_bonus_every_arcadas: commissionData.consultant_bonus_every_arcadas,
              consultant_bonus_value: commissionData.consultant_bonus_value,
              manager_bonus_35_arcadas: commissionData.manager_bonus_35_arcadas,
              manager_bonus_50_arcadas: commissionData.manager_bonus_50_arcadas,
              manager_bonus_75_arcadas: commissionData.manager_bonus_75_arcadas,
            })

          if (commissionError) {
            console.warn('Erro ao criar configurações de comissão:', commissionError)
            // Não interromper o processo, apenas avisar
            toast.success('Estabelecimento criado, mas houve problema ao configurar comissões')
          }
        }
        
        toast.success('Estabelecimento criado com sucesso!')
      } else {
        // Edição
        if (!selectedEstablishment) return

        const { error } = await supabase
          .from('establishment_codes')
          .update({
            name: formData.name,
            description: formData.description || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            phone: formData.phone || null,
            email: formData.email || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedEstablishment.id)

        if (error) throw error
        toast.success('Estabelecimento atualizado com sucesso!')
      }

      setIsModalOpen(false)
      fetchEstablishments()
    } catch (error: any) {
      console.error('Erro ao salvar estabelecimento:', error)
      toast.error('Erro ao salvar estabelecimento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (establishment: EstablishmentCode) => {
    try {
      const newStatus = !establishment.is_active

      const { error } = await supabase
        .from('establishment_codes')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', establishment.id)

      if (error) throw error

      toast.success(`Estabelecimento ${newStatus ? 'ativado' : 'desativado'} com sucesso!`)
      fetchEstablishments()
    } catch (error: any) {
      console.error('Erro ao alterar status:', error)
      toast.error('Erro ao alterar status')
    }
  }

  const handleDelete = async () => {
    if (!selectedEstablishment) return

    try {
      setSubmitting(true)

      // Verificar se há usuários vinculados
      const { data: users, error: usersError } = await supabase
        .from('user_establishments')
        .select('id')
        .eq('establishment_code', selectedEstablishment.code)

      if (usersError) throw usersError

      if (users && users.length > 0) {
        toast.error('Não é possível excluir um estabelecimento com usuários vinculados.')
        return
      }

      const { error } = await supabase
        .from('establishment_codes')
        .delete()
        .eq('id', selectedEstablishment.id)

      if (error) throw error

      toast.success('Estabelecimento removido com sucesso!')
      setIsDeleteModalOpen(false)
      setSelectedEstablishment(null)
      fetchEstablishments()
    } catch (error: any) {
      console.error('Erro ao deletar estabelecimento:', error)
      toast.error('Erro ao remover estabelecimento')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenCommissionModal = (establishment: EstablishmentCode) => {
    console.log('🔧 Abrindo modal de comissões para:', establishment.name)
    setSelectedEstablishment(establishment)
    setIsCommissionModalOpen(true)
  }

  const handleOpenDetailModal = async (establishment: EstablishmentCode) => {
    console.log('📊 Abrindo modal de detalhes para:', establishment.name)
    setSelectedEstablishment(establishment)
    setLoadingDetails(true)
    setIsDetailModalOpen(true)

    try {
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
      toast.error('Erro ao carregar detalhes do estabelecimento')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseCommissionModal = () => {
    setIsCommissionModalOpen(false)
    setSelectedEstablishment(null)
    fetchEstablishments() // Recarregar para atualizar configurações
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedEstablishment(null)
    setDetailData(null)
  }

  const filteredEstablishments = establishments.filter(est => {
    const matchesSearch = !searchTerm ||
      est.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.code.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter ||
      (statusFilter === 'active' && est.is_active) ||
      (statusFilter === 'inactive' && !est.is_active)

    return matchesSearch && matchesStatus
  })

  const stats = {
    total: establishments.length,
    active: establishments.filter(e => e.is_active).length,
    inactive: establishments.filter(e => !e.is_active).length,
    totalUsers: establishments.reduce((sum, e) => sum + (e._stats?.users_count || 0), 0),
    totalLeads: establishments.reduce((sum, e) => sum + (e._stats?.leads_count || 0), 0),
    totalRevenue: establishments.reduce((sum, e) => sum + (e._stats?.total_revenue || 0), 0),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (profile?.role !== 'clinic_admin') {
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
          <h1 className="text-2xl font-bold text-secondary-900">Estabelecimentos</h1>
          <p className="text-secondary-600">
            Gerencie os estabelecimentos e suas configurações de comissão
          </p>
        </div>

        <button
          onClick={() => handleOpenModal('create')}
          className="btn btn-primary"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Novo Estabelecimento
        </button>
      </div>

      {/* Enhanced Stats */}
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
                <p className="text-xs text-secondary-400">Estabelecimentos</p>
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
                <p className="text-xs text-secondary-400">Estabelecimentos</p>
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
                  <span className="text-sm font-bold text-primary-600">{stats.totalUsers}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Usuários</p>
                <p className="text-xs text-secondary-400">Vinculados</p>
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
                  <span className="text-sm font-bold text-success-600">{stats.totalLeads}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Leads</p>
                <p className="text-xs text-secondary-400">Gerados</p>
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
                  <CurrencyDollarIcon className="w-4 h-4 text-warning-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Receita</p>
                <p className="text-xs font-bold text-warning-600">
                  R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
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
                  <span className="text-sm font-bold text-danger-600">{stats.inactive}</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-secondary-500">Inativos</p>
                <p className="text-xs text-secondary-400">Estabelecimentos</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card"
      >
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
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

      {/* Enhanced Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Estabelecimento</th>
                  <th>Código</th>
                  <th>Localização</th>
                  <th>Estatísticas</th>
                  <th>Receita</th>
                  <th>Comissões</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEstablishments.map((establishment) => (
                  <tr key={establishment.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                            <BuildingOfficeIcon className="h-5 w-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">
                            {establishment.name}
                          </div>
                          {establishment.description && (
                            <div className="text-sm text-secondary-500">
                              {establishment.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="px-2 py-1 bg-secondary-100 rounded text-sm font-mono">
                        {establishment.code}
                      </code>
                    </td>
                    <td>
                      <div className="text-sm">
                        {establishment.city && establishment.state ? (
                          <span>{establishment.city}, {establishment.state}</span>
                        ) : (
                          <span className="text-secondary-400">Não informado</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {establishment._stats?.users_count || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Usuários</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-primary-600">
                            {establishment._stats?.leads_count || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Leads</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-success-600">
                            {establishment._stats?.converted_leads || 0}
                          </div>
                          <div className="text-xs text-secondary-500">Convertidos</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-center">
                        <div className="text-sm font-medium text-success-600">
                          R$ {(establishment._stats?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-secondary-500">
                          Total gerado
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-center">
                        <div className="text-sm font-medium text-warning-600">
                          R$ {establishment._commission_settings?.consultant_value_per_arcada.toLocaleString('pt-BR') || '750'}/arcada
                        </div>
                        <div className="text-xs text-secondary-500">
                          Consultor
                        </div>
                        <div className="text-xs text-primary-600 mt-1">
                          R$ {establishment._commission_settings?.manager_bonus_35_arcadas.toLocaleString('pt-BR') || '5.000'} (35 arc.)
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(establishment)}
                        className={`badge cursor-pointer hover:opacity-80 border-0 ${
                          establishment.is_active ? 'badge-success' : 'badge-danger'
                        }`}
                      >
                        {establishment.is_active ? (
                          <>
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Inativo
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleOpenDetailModal(establishment)}
                          className="btn btn-ghost btn-sm"
                          title="Ver Detalhes"
                        >
                          <ChartBarIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenCommissionModal(establishment)}
                          className="btn btn-ghost btn-sm text-primary-600"
                          title="Configurar Comissões"
                        >
                          <CurrencyDollarIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenModal('edit', establishment)}
                          className="btn btn-ghost btn-sm"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEstablishment(establishment)
                            setIsDeleteModalOpen(true)
                          }}
                          className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                          title="Remover"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEstablishments.length === 0 && (
              <div className="text-center py-12">
                <BuildingOfficeIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                  {establishments.length === 0 ? 'Nenhum estabelecimento encontrado' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-secondary-500">
                  {establishments.length === 0
                    ? 'Comece adicionando seu primeiro estabelecimento.'
                    : 'Tente ajustar os filtros ou termo de busca.'}
                </p>
                {establishments.length === 0 && (
                  <button
                    onClick={() => handleOpenModal('create')}
                    className="btn btn-primary mt-4"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Estabelecimento
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Create/Edit Modal */}
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                    {modalMode === 'create' ? 'Novo Estabelecimento' : 'Editar Estabelecimento'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Código *
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            className="input flex-1 uppercase"
                            value={formData.code}
                            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            placeholder="ABC123"
                            maxLength={6}
                            disabled={modalMode === 'edit'}
                          />
                          {modalMode === 'create' && (
                            <button
                              type="button"
                              onClick={generateCode}
                              className="btn btn-secondary"
                            >
                              Gerar
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Nome *
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Nome do estabelecimento"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Descrição
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descrição opcional"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Endereço
                      </label>
                      <input
                        type="text"
                        className="input"
                        value={formData.address}
                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Endereço completo"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Cidade
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formData.city}
                          onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                          placeholder="Cidade"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                          Estado
                        </label>
                        <input
                          type="text"
                          className="input"
                          value={formData.state}
                          onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                          Email
                        </label>
                        <input
                          type="email"
                          className="input"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="contato@estabelecimento.com"
                        />
                      </div>
                    </div>
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
                        !formData.code ||
                        !formData.name ||
                        formData.code.length !== 6
                      }
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          {modalMode === 'create' ? 'Criando...' : 'Salvando...'}
                        </>
                      ) : (
                        modalMode === 'create' ? 'Criar Estabelecimento' : 'Salvar Alterações'
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
                    Tem certeza que deseja remover o estabelecimento <strong>{selectedEstablishment?.name}</strong>?
                    Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
                  </p>

                  <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-warning-700">
                      <strong>Atenção:</strong> Certifique-se de que este estabelecimento não possui usuários vinculados antes de excluir.
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
                      onClick={handleDelete}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Removendo...
                        </>
                      ) : (
                        'Remover Estabelecimento'
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