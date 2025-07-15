// src/app/dashboard/establishments/page.tsx - VERSÃO CORRIGIDA COM MODALS
'use client'

import { useState, useEffect, AwaitedReactNode, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from 'react'
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
  UsersIcon,
  UserGroupIcon,
  XMarkIcon,
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

  // Estados dos modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [submitting, setSubmitting] = useState(false)
  const [detailData, setDetailData] = useState<EstablishmentDetailData | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Estados do formulário principal
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

  // Estados das configurações de comissão
  const [commissionData, setCommissionData] = useState({
    consultant_value_per_arcada: 750,
    consultant_bonus_every_arcadas: 7,
    consultant_bonus_value: 750,
    manager_bonus_active: true, 
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
          try {
            console.log(`🔍 Processando estabelecimento: ${establishment.name} (${establishment.code})`)

            // 1. Buscar usuários do estabelecimento
            const { data: usersData, count: usersCount, error: usersError } = await supabase
              .from('user_establishments')
              .select('user_id', { count: 'exact' })
              .eq('establishment_code', establishment.code)
              .eq('status', 'active')

            if (usersError) {
              console.error(`❌ Erro ao buscar usuários do estabelecimento ${establishment.code}:`, usersError)
            }

            const userIds = usersData?.map(u => u.user_id) || []
            console.log(`👥 Usuários encontrados para ${establishment.code}:`, userIds.length)

            // 2. Buscar leads DE DUAS FORMAS (para garantir que não perdemos nenhum)
            // A) Por establishment_code direto
            const { data: leadsByCode, error: leadsCodeError } = await supabase
              .from('leads')
              .select('id, status, arcadas_vendidas, indicated_by')
              .eq('establishment_code', establishment.code)

            // B) Por usuários do estabelecimento (fallback caso establishment_code não esteja preenchido)
            const { data: leadsByUsers, error: leadsUsersError } = await supabase
              .from('leads')
              .select('id, status, arcadas_vendidas, indicated_by, establishment_code')
              .in('indicated_by', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']) // UUID inválido se não há usuários

            if (leadsCodeError) {
              console.error(`❌ Erro ao buscar leads por código:`, leadsCodeError)
            }
            if (leadsUsersError) {
              console.error(`❌ Erro ao buscar leads por usuários:`, leadsUsersError)
            }

            // Combinar e dedupllicar leads
            const allLeadIds = new Set<string>()
            const combinedLeads: any[] = []

            // Priorizar leads que JÁ têm establishment_code
            leadsByCode?.forEach(lead => {
              allLeadIds.add(lead.id)
              combinedLeads.push(lead)
            })

            // Adicionar leads de usuários que NÃO têm establishment_code ainda
            leadsByUsers?.forEach(lead => {
              if (!allLeadIds.has(lead.id)) {
                combinedLeads.push(lead)
              }
            })

            console.log(`📊 Leads por código direto: ${leadsByCode?.length || 0}`)
            console.log(`📊 Leads por usuários: ${leadsByUsers?.length || 0}`)
            console.log(`📊 Total de leads únicos: ${combinedLeads.length}`)

            // 3. Buscar comissões DE DUAS FORMAS também
            const { data: commissionsByCode, error: commissionsCodeError } = await supabase
              .from('commissions')
              .select('id, amount, status, user_id')
              .eq('establishment_code', establishment.code)

            const { data: commissionsByUsers, error: commissionsUsersError } = await supabase
              .from('commissions')
              .select('id, amount, status, user_id, establishment_code')
              .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

            if (commissionsCodeError) {
              console.error(`❌ Erro ao buscar comissões por código:`, commissionsCodeError)
            }
            if (commissionsUsersError) {
              console.error(`❌ Erro ao buscar comissões por usuários:`, commissionsUsersError)
            }

            // Combinar e deduplicar comissões
            const allCommissionIds = new Set<string>()
            const combinedCommissions: any[] = []

            commissionsByCode?.forEach(commission => {
              allCommissionIds.add(commission.id)
              combinedCommissions.push(commission)
            })

            commissionsByUsers?.forEach(commission => {
              if (!allCommissionIds.has(commission.id)) {
                combinedCommissions.push(commission)
              }
            })

            console.log(`💰 Comissões por código: ${commissionsByCode?.length || 0}`)
            console.log(`💰 Comissões por usuários: ${commissionsByUsers?.length || 0}`)
            console.log(`💰 Total comissões únicas: ${combinedCommissions.length}`)

            // 4. Buscar configurações específicas do estabelecimento
            const { data: settingsData, error: settingsError } = await supabase
              .from('establishment_commissions')
              .select('*')
              .eq('establishment_code', establishment.code)
              .single()

            if (settingsError && settingsError.code !== 'PGRST116') {
              console.error(`❌ Erro ao buscar configurações:`, settingsError)
            }

            // 5. Calcular estatísticas
            const convertedLeads = combinedLeads.filter(l => l.status === 'converted')
            const totalArcadas = convertedLeads.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)

            console.log(`✅ Leads convertidos: ${convertedLeads.length}`)
            console.log(`✅ Total de arcadas: ${totalArcadas}`)

            // Usar configuração específica ou padrão
            const commissionSettings = settingsData || {
              consultant_value_per_arcada: 750,
              manager_bonus_35_arcadas: 5000,
              manager_bonus_50_arcadas: 10000,
              manager_bonus_75_arcadas: 15000,
            }

            // IMPORTANTE: Aqui você precisa definir o valor real do tratamento
            // Por enquanto, vou usar o valor da comissão como proxy
            // Mas idealmente deveria ser: totalArcadas * VALOR_REAL_DO_TRATAMENTO
            const totalRevenue = totalArcadas * commissionSettings.consultant_value_per_arcada
            const totalCommissions = combinedCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)

            console.log(`💵 Revenue calculado: R$ ${totalRevenue}`)
            console.log(`💵 Comissões totais: R$ ${totalCommissions}`)
            console.log(`=====================================`)

            return {
              ...establishment,
              _stats: {
                users_count: usersCount || 0,
                leads_count: combinedLeads.length,
                total_revenue: totalRevenue,
                total_commissions: totalCommissions,
                converted_leads: convertedLeads.length,
              },
              _commission_settings: commissionSettings
            }

          } catch (error) {
            console.error(`❌ Erro ao processar estabelecimento ${establishment.code}:`, error)
            // Retornar dados básicos em caso de erro
            return {
              ...establishment,
              _stats: {
                users_count: 0,
                leads_count: 0,
                total_revenue: 0,
                total_commissions: 0,
                converted_leads: 0,
              },
              _commission_settings: {
                consultant_value_per_arcada: 750,
                manager_bonus_35_arcadas: 5000,
                manager_bonus_50_arcadas: 10000,
                manager_bonus_75_arcadas: 15000,
              }
            }
          }
        })
      )

      setEstablishments(establishmentsWithStats)
    } catch (error: any) {
      console.error('❌ Erro geral ao buscar estabelecimentos:', error)
      toast.error('Erro ao carregar estabelecimentos')
    } finally {
      setLoading(false)
    }
  }

  // FUNÇÃO ADICIONAL: Para corrigir dados existentes
  const fixExistingLeadsAndCommissions = async () => {
    try {
      console.log('🔧 Iniciando correção de dados existentes...')

      // 1. Corrigir leads sem establishment_code
      const { data: leadsWithoutCode } = await supabase
        .from('leads')
        .select('id, indicated_by')
        .is('establishment_code', null)

      console.log(`📋 Encontrados ${leadsWithoutCode?.length || 0} leads sem establishment_code`)

      for (const lead of leadsWithoutCode || []) {
        const { data: userEst } = await supabase
          .from('user_establishments')
          .select('establishment_code')
          .eq('user_id', lead.indicated_by)
          .eq('status', 'active')
          .single()

        if (userEst?.establishment_code) {
          await supabase
            .from('leads')
            .update({ establishment_code: userEst.establishment_code })
            .eq('id', lead.id)

          console.log(`✅ Lead ${lead.id} associado ao estabelecimento ${userEst.establishment_code}`)
        }
      }

      // 2. Corrigir comissões sem establishment_code  
      const { data: commissionsWithoutCode } = await supabase
        .from('commissions')
        .select('id, user_id')
        .is('establishment_code', null)

      console.log(`💰 Encontradas ${commissionsWithoutCode?.length || 0} comissões sem establishment_code`)

      for (const commission of commissionsWithoutCode || []) {
        const { data: userEst } = await supabase
          .from('user_establishments')
          .select('establishment_code')
          .eq('user_id', commission.user_id)
          .eq('status', 'active')
          .single()

        if (userEst?.establishment_code) {
          await supabase
            .from('commissions')
            .update({ establishment_code: userEst.establishment_code })
            .eq('id', commission.id)

          console.log(`✅ Comissão ${commission.id} associada ao estabelecimento ${userEst.establishment_code}`)
        }
      }

      console.log('✅ Correção de dados concluída!')

      // Recarregar dados após correção
      await fetchEstablishments()

    } catch (error) {
      console.error('❌ Erro na correção de dados:', error)
    }
  }

  // Chamar a função de correção se necessário (pode ser um botão no admin)
  // useEffect(() => {
  //   if (profile?.role === 'clinic_admin') {
  //     fixExistingLeadsAndCommissions()
  //   }
  // }, [profile])

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setFormData(prev => ({ ...prev, code: result }))
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

        // 1. Criar estabelecimento
        const { data: newEstablishment, error } = await supabase
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
          .select()
          .single()

        if (error) throw error

        // 2. Criar configurações de comissão - ATUALIZADO com o switch
        const { error: commissionError } = await supabase
          .from('establishment_commissions')
          .insert({
            establishment_code: formData.code.toUpperCase(),
            consultant_value_per_arcada: commissionData.consultant_value_per_arcada,
            consultant_bonus_every_arcadas: commissionData.consultant_bonus_every_arcadas,
            consultant_bonus_value: commissionData.consultant_bonus_value,
            manager_bonus_active: commissionData.manager_bonus_active, // 🔥 NOVO: Incluir o switch
            manager_bonus_35_arcadas: commissionData.manager_bonus_active ? commissionData.manager_bonus_35_arcadas : 0,
            manager_bonus_50_arcadas: commissionData.manager_bonus_active ? commissionData.manager_bonus_50_arcadas : 0,
            manager_bonus_75_arcadas: commissionData.manager_bonus_active ? commissionData.manager_bonus_75_arcadas : 0,
          })

        if (commissionError) {
          console.warn('Erro ao criar configurações de comissão:', commissionError)
          toast.success('Estabelecimento criado, mas houve problema ao configurar comissões')
        } else {
          toast.success('Estabelecimento criado com sucesso!')
        }

      } else {
        // Edição (código existente)
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
      // Reset para valores padrão - ATUALIZADO com o switch
      setCommissionData({
        consultant_value_per_arcada: 750,
        consultant_bonus_every_arcadas: 7,
        consultant_bonus_value: 750,
        manager_bonus_active: true, // 🔥 PADRÃO: Bônus ativo
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

  // CORREÇÃO: Funções para abrir modais específicos
  const handleOpenCommissionModal = (establishment: EstablishmentCode) => {
    console.log('🔧 Abrindo modal de comissões para:', establishment.name)
    setSelectedEstablishment(establishment)
    setIsCommissionModalOpen(true)
  }

  const handleOpenDetailModal = async (establishment: EstablishmentCode) => {
    console.log('📊 Abrindo modal de detalhes para:', establishment.name, 'código:', establishment.code)
    setSelectedEstablishment(establishment)
    setLoadingDetails(true)
    setIsDetailModalOpen(true)

    try {
      console.log('🔍 Buscando dados detalhados...')

      // 1. Buscar usuários do estabelecimento
      const { data: usersResult, error: usersError } = await supabase
        .from('user_establishments')
        .select(`
        user_id,
        establishment_code,
        status,
        users!user_establishments_user_id_fkey (
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
        users!leads_indicated_by_fkey (
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
        users!commissions_user_id_fkey (
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

        // Pegar IDs dos usuários do estabelecimento
        const userIds = usersResult?.map(u => u.user_id) || []

        if (userIds.length > 0) {
          const { data: altLeads } = await supabase
            .from('leads')
            .select(`
            *,
            users!leads_indicated_by_fkey (
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
            users!commissions_user_id_fkey (
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
      setLoadingDetails(false)
    }
  }

  // Função para fechar modal de detalhes - SUBSTITUA a existente
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedEstablishment(null)
    setDetailData(null)
  }


  const handleCloseCommissionModal = () => {
    setIsCommissionModalOpen(false)
    setSelectedEstablishment(null)
    fetchEstablishments() // Recarregar para atualizar configurações
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
                          R$ {establishment._commission_settings?.consultant_value_per_arcada?.toLocaleString('pt-BR') || '750'}/arcada
                        </div>
                        <div className="text-xs text-secondary-500">
                          Consultor
                        </div>
                        <div className="text-xs text-primary-600 mt-1">
                          R$ {establishment._commission_settings?.manager_bonus_35_arcadas?.toLocaleString('pt-BR') || '5.000'} (35 arc.)
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(establishment)}
                        className={`badge cursor-pointer hover:opacity-80 border-0 ${establishment.is_active ? 'badge-success' : 'badge-danger'
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

      {/* Create/Edit Modal com Configurações de Comissão */}
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                    {modalMode === 'create' ? 'Novo Estabelecimento' : 'Editar Estabelecimento'}
                  </Dialog.Title>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Dados do Estabelecimento */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-secondary-900 mb-3">Dados do Estabelecimento</h4>

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

                      {/* Campos de endereço, telefone etc. - código existente */}
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

                    {/* Configurações de Comissão (apenas na criação) - ATUALIZADO */}
                    {modalMode === 'create' && (
                      <div className="space-y-4">
                        <h4 className="text-md font-medium text-secondary-900 mb-3">Configurações de Comissão</h4>

                        {/* Configurações do Consultor */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h5 className="text-sm font-medium text-blue-900 mb-3">Comissões do Consultor</h5>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-blue-800 mb-1">
                                Valor por Arcada (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input input-sm"
                                value={commissionData.consultant_value_per_arcada}
                                onChange={(e) => setCommissionData(prev => ({
                                  ...prev,
                                  consultant_value_per_arcada: parseFloat(e.target.value) || 0
                                }))}
                                placeholder="750.00"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">
                                  Bônus a cada X arcadas
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  className="input input-sm"
                                  value={commissionData.consultant_bonus_every_arcadas}
                                  onChange={(e) => setCommissionData(prev => ({
                                    ...prev,
                                    consultant_bonus_every_arcadas: parseInt(e.target.value) || 1
                                  }))}
                                  placeholder="7"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">
                                  Valor do Bônus (R$)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="input input-sm"
                                  value={commissionData.consultant_bonus_value}
                                  onChange={(e) => setCommissionData(prev => ({
                                    ...prev,
                                    consultant_bonus_value: parseFloat(e.target.value) || 0
                                  }))}
                                  placeholder="750.00"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Configurações do Gerente - ATUALIZADO com Switch */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h5 className="text-sm font-medium text-green-900">Comissões do Gerente</h5>
                            
                            {/* 🔥 NOVO: Toggle para ativar/desativar bônus */}
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-green-700">Bônus:</span>
                              <button
                                type="button"
                                onClick={() => setCommissionData(prev => ({
                                  ...prev,
                                  manager_bonus_active: !prev.manager_bonus_active
                                }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  commissionData.manager_bonus_active ? 'bg-green-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    commissionData.manager_bonus_active ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className="text-sm font-medium text-green-700">
                                {commissionData.manager_bonus_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {/* Info sobre comissão base */}
                            <div className="bg-blue-100 border border-blue-200 rounded p-3">
                              <p className="text-sm text-blue-800">
                                <strong>Comissão Base:</strong> Gerente ganha{' '}
                                <strong>R$ {commissionData.consultant_value_per_arcada}/arcada</strong>{' '}
                                por cada lead convertido da equipe (mesmo valor que consultores)
                              </p>
                            </div>

                            {/* Campos de bônus - só mostrar se ativo */}
                            {commissionData.manager_bonus_active ? (
                              <>
                                <div>
                                  <label className="block text-xs font-medium text-green-800 mb-1">
                                    Bônus a cada 35 arcadas (R$)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input input-sm"
                                    value={commissionData.manager_bonus_35_arcadas}
                                    onChange={(e) => setCommissionData(prev => ({
                                      ...prev,
                                      manager_bonus_35_arcadas: parseFloat(e.target.value) || 0
                                    }))}
                                    placeholder="5000.00"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-xs font-medium text-green-800 mb-1">
                                      Bônus 50 arcadas (R$)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input input-sm"
                                      value={commissionData.manager_bonus_50_arcadas}
                                      onChange={(e) => setCommissionData(prev => ({
                                        ...prev,
                                        manager_bonus_50_arcadas: parseFloat(e.target.value) || 0
                                      }))}
                                      placeholder="10000.00"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-green-800 mb-1">
                                      Bônus 75 arcadas (R$)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input input-sm"
                                      value={commissionData.manager_bonus_75_arcadas}
                                      onChange={(e) => setCommissionData(prev => ({
                                        ...prev,
                                        manager_bonus_75_arcadas: parseFloat(e.target.value) || 0
                                      }))}
                                      placeholder="15000.00"
                                    />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <div className="bg-gray-100 rounded p-3">
                                <p className="text-sm text-gray-600">
                                  Bônus desativado. Gerente receberá apenas comissão base por arcada da equipe.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Preview das Configurações - ATUALIZADO */}
                        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-3">
                          <h5 className="text-xs font-medium text-secondary-900 mb-2">Resumo</h5>
                          <div className="text-xs text-secondary-700 space-y-1">
                            <div>• Consultor: R$ {commissionData.consultant_value_per_arcada}/arcada + bônus a cada {commissionData.consultant_bonus_every_arcadas} arcadas</div>
                            <div>• Gerente: R$ {commissionData.consultant_value_per_arcada}/arcada da equipe 
                              {commissionData.manager_bonus_active ? 
                                ` + bônus em 35, 50 e 75 arcadas` : 
                                ` (sem bônus)`
                              }
                            </div>
                            {commissionData.manager_bonus_active && (
                              <div className="text-xs text-green-600 ml-4">
                                → Bônus: R$ {commissionData.manager_bonus_35_arcadas} (35), R$ {commissionData.manager_bonus_50_arcadas} (50), R$ {commissionData.manager_bonus_75_arcadas} (75)
                              </div>
                            )}
                          </div>
                        </div>
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

      {/* Commission Settings Modal */}
      {isCommissionModalOpen && selectedEstablishment && (
        <CommissionSettingsModal
          isOpen={isCommissionModalOpen}
          onClose={handleCloseCommissionModal}
          establishmentCode={selectedEstablishment.code}
          establishmentName={selectedEstablishment.name}
          onSuccess={() => {
            toast.success('Configurações de comissão atualizadas!')
            handleCloseCommissionModal()
          }}
        />
      )}

      {/* Detail Modal */}
      <Transition appear show={isDetailModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseDetailModal}>
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
                      Relatório Detalhado - {selectedEstablishment?.name}
                    </Dialog.Title>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleCloseDetailModal}
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {loadingDetails ? (
                    <div className="flex items-center justify-center p-12">
                      <div className="loading-spinner w-8 h-8"></div>
                    </div>
                  ) : detailData ? (
                    <div className="p-6">
                      {/* Stats Summary */}
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                            <UsersIcon className="h-5 w-5 mr-2" />
                            Leads ({detailData.leads.length})
                          </h4>
                          <div className="space-y-1 text-sm text-blue-700">
                            <div>Novos: {detailData.leads.filter(l => l.status === 'new').length}</div>
                            <div>Contatados: {detailData.leads.filter(l => l.status === 'contacted').length}</div>
                            <div>Convertidos: {detailData.leads.filter(l => l.status === 'converted').length}</div>
                            <div>Perdidos: {detailData.leads.filter(l => l.status === 'lost').length}</div>
                          </div>
                        </div>

                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-medium text-green-900 mb-2 flex items-center">
                            <UserGroupIcon className="h-5 w-5 mr-2" />
                            Equipe ({detailData.users.length})
                          </h4>
                          <div className="space-y-1 text-sm text-green-700">
                            <div>Gerentes: {detailData.users.filter(u => u.users?.role === 'manager').length}</div>
                            <div>Consultores: {detailData.users.filter(u => u.users?.role === 'consultant').length}</div>
                            <div>Conversão: {
                              detailData.leads.length > 0
                                ? ((detailData.leads.filter(l => l.status === 'converted').length / detailData.leads.length) * 100).toFixed(1)
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
                            <div>Total Comissões: R$ {detailData.commissions.reduce((sum, c) => sum + c.amount, 0).toLocaleString('pt-BR')}</div>
                            <div>Pagas: R$ {detailData.commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0).toLocaleString('pt-BR')}</div>
                            <div>Pendentes: R$ {detailData.commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0).toLocaleString('pt-BR')}</div>
                          </div>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                            <ChartBarIcon className="h-5 w-5 mr-2" />
                            Performance
                          </h4>
                          <div className="space-y-1 text-sm text-purple-700">
                            <div>Arcadas: {detailData.leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)}</div>
                            <div>Receita: R$ {((detailData.leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)) * 750).toLocaleString('pt-BR')}</div>
                            <div>Ticket Médio: R$ {
                              detailData.leads.filter(l => l.status === 'converted').length > 0
                                ? (((detailData.leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)) * 750) / detailData.leads.filter(l => l.status === 'converted').length).toLocaleString('pt-BR')
                                : '0'
                            }</div>
                          </div>
                        </div>
                      </div>

                      {/* Seção Principal: Consultores e Leads por Consultor */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        {/* Consultores com Performance */}
                        <div className="bg-white border border-secondary-200 rounded-lg p-6">
                          <h4 className="font-medium text-secondary-900 mb-4 flex items-center">
                            <UserGroupIcon className="h-5 w-5 mr-2" />
                            Performance por Consultor
                          </h4>
                          <div className="space-y-4">
                            {(() => {
                              // Agrupar leads por consultor
                              const consultorsMap = new Map()

                              // Primeiro, adicionar todos os consultores do estabelecimento
                              detailData.users
                                .filter(u => u.users?.role === 'consultant')
                                .forEach(userEst => {
                                  consultorsMap.set(userEst.user_id, {
                                    id: userEst.user_id,
                                    name: userEst.users.full_name,
                                    email: userEst.users.email,
                                    leads: [],
                                    totalLeads: 0,
                                    convertedLeads: 0,
                                    totalArcadas: 0,
                                    totalComissoes: 0,
                                    manager: null
                                  })
                                })

                              // Adicionar leads aos consultores
                              detailData.leads.forEach(lead => {
                                if (consultorsMap.has(lead.indicated_by)) {
                                  const consultor = consultorsMap.get(lead.indicated_by)
                                  consultor.leads.push(lead)
                                  consultor.totalLeads++
                                  if (lead.status === 'converted') {
                                    consultor.convertedLeads++
                                    consultor.totalArcadas += (lead.arcadas_vendidas || 1)
                                  }
                                }
                              })

                              // Adicionar comissões aos consultores
                              detailData.commissions.forEach(commission => {
                                if (consultorsMap.has(commission.user_id) && commission.type === 'consultant') {
                                  const consultor = consultorsMap.get(commission.user_id)
                                  consultor.totalComissoes += commission.amount || 0
                                }
                              })

                              return Array.from(consultorsMap.values()).map((consultor, index) => (
                                <div key={consultor.id} className="border border-secondary-100 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center">
                                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium mr-3">
                                        {consultor.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="font-medium text-secondary-900">{consultor.name}</div>
                                        <div className="text-sm text-secondary-500">{consultor.email}</div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-success-600">
                                        R$ {consultor.totalComissoes.toLocaleString('pt-BR')}
                                      </div>
                                      <div className="text-xs text-secondary-500">Comissões</div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-4 gap-3 text-center text-sm">
                                    <div>
                                      <div className="font-medium text-primary-600">{consultor.totalLeads}</div>
                                      <div className="text-xs text-secondary-500">Total Leads</div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-success-600">{consultor.convertedLeads}</div>
                                      <div className="text-xs text-secondary-500">Convertidos</div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-purple-600">{consultor.totalArcadas}</div>
                                      <div className="text-xs text-secondary-500">Arcadas</div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-warning-600">
                                        {consultor.totalLeads > 0 ? ((consultor.convertedLeads / consultor.totalLeads) * 100).toFixed(1) : 0}%
                                      </div>
                                      <div className="text-xs text-secondary-500">Conversão</div>
                                    </div>
                                  </div>

                                  {/* Leads convertidos deste consultor */}
                                  {consultor.leads.filter((l: { status: string }) => l.status === 'converted').length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-secondary-100">
                                      <div className="text-xs font-medium text-secondary-700 mb-2">Leads Convertidos:</div>
                                      <div className="space-y-1">
                                        {consultor.leads
                                          .filter((l: { status: string }) => l.status === 'converted')
                                          .map((lead: { id: Key | null | undefined; full_name: string | number | bigint | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Promise<AwaitedReactNode> | null | undefined; arcadas_vendidas: any; converted_at: any; updated_at: any }) => (
                                            <div key={lead.id} className="flex justify-between items-center text-xs">
                                              <span className="text-secondary-600">{lead.full_name}</span>
                                              <div className="flex items-center space-x-2">
                                                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                                  {lead.arcadas_vendidas || 1} arcada{(lead.arcadas_vendidas || 1) > 1 ? 's' : ''}
                                                </span>
                                                <span className="text-secondary-500">
                                                  {new Date(lead.converted_at || lead.updated_at).toLocaleDateString('pt-BR')}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            })()}
                          </div>
                        </div>

                        {/* Gerentes e Hierarquia */}
                        <div className="bg-white border border-secondary-200 rounded-lg p-6">
                          <h4 className="font-medium text-secondary-900 mb-4 flex items-center">
                            <UserGroupIcon className="h-5 w-5 mr-2" />
                            Gerentes e Hierarquia
                          </h4>

                          {(() => {
                            const managers = detailData.users.filter(u => u.users?.role === 'manager')

                            if (managers.length === 0) {
                              return (
                                <div className="text-center py-6 text-secondary-500">
                                  <UserGroupIcon className="h-12 w-12 mx-auto mb-2 text-secondary-300" />
                                  <p>Nenhum gerente vinculado a este estabelecimento</p>
                                </div>
                              )
                            }

                            return managers.map(managerEst => (
                              <div key={managerEst.user_id} className="border border-secondary-100 rounded-lg p-4 mb-4">
                                <div className="flex items-center mb-4">
                                  <div className="w-12 h-12 bg-success-600 rounded-full flex items-center justify-center text-white font-medium mr-4">
                                    {managerEst.users.full_name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-secondary-900">{managerEst.users.full_name}</div>
                                    <div className="text-sm text-secondary-500">{managerEst.users.email}</div>
                                    <div className="text-xs text-success-600 font-medium">Gerente</div>
                                  </div>
                                </div>

                                {/* Comissões do Gerente */}
                                {(() => {
                                  const managerCommissions = detailData.commissions.filter(c =>
                                    c.user_id === managerEst.user_id && c.type === 'manager'
                                  )
                                  const totalManagerCommissions = managerCommissions.reduce((sum, c) => sum + (c.amount || 0), 0)

                                  return (
                                    <div className="grid grid-cols-3 gap-4 text-center text-sm mb-4">
                                      <div>
                                        <div className="font-medium text-success-600">R$ {totalManagerCommissions.toLocaleString('pt-BR')}</div>
                                        <div className="text-xs text-secondary-500">Comissões Gerente</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-primary-600">{managerCommissions.length}</div>
                                        <div className="text-xs text-secondary-500">Bônus Recebidos</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-warning-600">
                                          {managerCommissions.filter(c => c.status === 'paid').length}
                                        </div>
                                        <div className="text-xs text-secondary-500">Pagos</div>
                                      </div>
                                    </div>
                                  )
                                })()}

                                {/* Equipe do Gerente */}
                                {(() => {
                                  const teamConsultants = detailData.users.filter(u =>
                                    u.users?.role === 'consultant'
                                    // Aqui você poderia adicionar lógica para verificar hierarquia se tiver essa informação
                                  )

                                  if (teamConsultants.length > 0) {
                                    return (
                                      <div>
                                        <div className="text-xs font-medium text-secondary-700 mb-2">Equipe:</div>
                                        <div className="grid grid-cols-1 gap-2">
                                          {teamConsultants.map(consultant => {
                                            const consultantLeads = detailData.leads.filter(l => l.indicated_by === consultant.user_id)
                                            const convertedLeads = consultantLeads.filter(l => l.status === 'converted')

                                            return (
                                              <div key={consultant.user_id} className="flex justify-between items-center text-xs bg-secondary-50 rounded p-2">
                                                <span className="font-medium">{consultant.users.full_name}</span>
                                                <div className="flex space-x-3 text-secondary-600">
                                                  <span>{consultantLeads.length} leads</span>
                                                  <span className="text-success-600">{convertedLeads.length} convertidos</span>
                                                  <span className="text-purple-600">
                                                    {convertedLeads.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)} arcadas
                                                  </span>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  }

                                  return (
                                    <div className="text-xs text-secondary-500 italic">
                                      Nenhum consultor direto identificado
                                    </div>
                                  )
                                })()}
                              </div>
                            ))
                          })()}
                        </div>
                      </div>

                      {/* Timeline de Conversões */}
                      <div className="bg-white border border-secondary-200 rounded-lg p-6 mb-8">
                        <h4 className="font-medium text-secondary-900 mb-4 flex items-center">
                          <ChartBarIcon className="h-5 w-5 mr-2" />
                          Timeline de Conversões
                        </h4>

                        {(() => {
                          const convertedLeads = detailData.leads
                            .filter(l => l.status === 'converted')
                            .sort((a, b) => new Date(b.converted_at || b.updated_at).getTime() - new Date(a.converted_at || a.updated_at).getTime())

                          if (convertedLeads.length === 0) {
                            return (
                              <div className="text-center py-6 text-secondary-500">
                                <ChartBarIcon className="h-12 w-12 mx-auto mb-2 text-secondary-300" />
                                <p>Nenhuma conversão registrada ainda</p>
                              </div>
                            )
                          }

                          return (
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                              {convertedLeads.map((lead, index) => {
                                const leadUser = detailData.users.find(u => u.user_id === lead.indicated_by)

                                return (
                                  <div key={lead.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-success-50 to-success-25 border-l-4 border-success-500 rounded-r-lg">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-8 h-8 bg-success-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className="font-medium text-secondary-900">{lead.full_name}</div>
                                        <div className="text-sm text-secondary-600">
                                          por {leadUser?.users?.full_name || 'Consultor não identificado'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                      <div className="text-center">
                                        <div className="text-lg font-bold text-purple-600">
                                          {lead.arcadas_vendidas || 1}
                                        </div>
                                        <div className="text-xs text-secondary-500">
                                          arcada{(lead.arcadas_vendidas || 1) > 1 ? 's' : ''}
                                        </div>
                                      </div>

                                      <div className="text-center">
                                        <div className="text-sm font-medium text-success-600">
                                          R$ {((lead.arcadas_vendidas || 1) * 750).toLocaleString('pt-BR')}
                                        </div>
                                        <div className="text-xs text-secondary-500">comissão</div>
                                      </div>

                                      <div className="text-center">
                                        <div className="text-sm text-secondary-700">
                                          {new Date(lead.converted_at || lead.updated_at).toLocaleDateString('pt-BR')}
                                        </div>
                                        <div className="text-xs text-secondary-500">
                                          {new Date(lead.converted_at || lead.updated_at).toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>

                      {/* Resumo Final */}
                      <div className="bg-gradient-to-r from-primary-50 to-success-50 border border-primary-200 rounded-lg p-6">
                        <h4 className="font-medium text-primary-900 mb-4">Resumo Executivo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                          <div>
                            <div className="text-2xl font-bold text-primary-600">
                              {detailData.leads.filter(l => l.status === 'converted').length}
                            </div>
                            <div className="text-sm text-primary-700">Conversões Totais</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-purple-600">
                              {detailData.leads.filter(l => l.status === 'converted').reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0)}
                            </div>
                            <div className="text-sm text-purple-700">Arcadas Vendidas</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-success-600">
                              R$ {detailData.commissions.reduce((sum, c) => sum + (c.amount || 0), 0).toLocaleString('pt-BR')}
                            </div>
                            <div className="text-sm text-success-700">Comissões Totais</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-warning-600">
                              {detailData.leads.length > 0 ?
                                ((detailData.leads.filter(l => l.status === 'converted').length / detailData.leads.length) * 100).toFixed(1)
                                : 0}%
                            </div>
                            <div className="text-sm text-warning-700">Taxa de Conversão</div>
                          </div>
                        </div>
                      </div>
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
    </div>
  )
}