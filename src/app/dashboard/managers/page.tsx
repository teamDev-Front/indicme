// src/app/dashboard/managers/page.tsx - CORRIGIDA COM MODAL DE DETALHES
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
import EstablishmentAutocomplete from '@/components/establishments/EstablishmentAutocomplete'
import ManagerDetailModal from '@/components/managers/ManagerDetailModal' // 🔥 NOVO IMPORT

interface Manager {
  id: string
  email: string
  full_name: string
  phone: string | null
  role: string
  status: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
  establishment_name: string
  _count: {
    consultants: number
    leads: number
    commissions: number
  }
  _stats: {
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
  const [establishmentFilter, setEstablishmentFilter] = useState('')
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // 🔥 NOVO
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null) // 🔥 NOVO
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    establishment_name: '',
    password: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [establishments, setEstablishments] = useState<string[]>([])
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

      // Buscar managers
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

      // Para cada manager, buscar estatísticas
      const managersWithStats = await Promise.all(
        (managersData || []).map(async (manager) => {
          try {
            // Buscar estabelecimento do manager
            let establishmentName = 'Estabelecimento não definido'

            const { data: userEst } = await supabase
              .from('user_establishments')
              .select(`
                establishment_code,
                establishment_code (
                  name
                )
              `)
              .eq('user_id', manager.id)
              .eq('status', 'active')
              .limit(1)
              .single()

            if (userEst?.establishment_code?.name) {
              establishmentName = userEst.establishment_code.name
            }

            // Contar consultores
            const { count: consultantsCount } = await supabase
              .from('hierarchies')
              .select('consultant_id', { count: 'exact' })
              .eq('manager_id', manager.id)

            // Contar leads
            const { data: hierarchy } = await supabase
              .from('hierarchies')
              .select('consultant_id')
              .eq('manager_id', manager.id)

            const consultantIds = hierarchy?.map(h => h.consultant_id) || []
            consultantIds.push(manager.id) // incluir próprios leads

            const { count: leadsCount } = await supabase
              .from('leads')
              .select('id', { count: 'exact' })
              .in('indicated_by', consultantIds)

            // Buscar comissões
            const { data: commissionsData } = await supabase
              .from('commissions')
              .select('amount, status')
              .eq('user_id', manager.id)

            const totalCommissions = commissionsData
              ?.filter(c => c.status === 'paid')
              ?.reduce((sum, c) => sum + c.amount, 0) || 0

            const paidCommissionsCount = commissionsData
              ?.filter(c => c.status === 'paid')?.length || 0

            return {
              ...manager,
              establishment_name: establishmentName,
              _count: {
                consultants: consultantsCount || 0,
                leads: leadsCount || 0,
                commissions: paidCommissionsCount,
              },
              _stats: {
                totalCommissions,
                conversionRate: 0,
              }
            } as Manager

          } catch (error) {
            console.error('Erro ao buscar stats do manager:', manager.id, error)
            return {
              ...manager,
              establishment_name: 'Erro ao carregar',
              _count: {
                consultants: 0,
                leads: 0,
                commissions: 0,
              },
              _stats: {
                totalCommissions: 0,
                conversionRate: 0,
              }
            } as Manager
          }
        })
      )

      setManagers(managersWithStats)

      // Extrair estabelecimentos únicos
      const uniqueEstablishments = managersWithStats
        .map(m => m.establishment_name)
        .filter((name): name is string =>
          name !== undefined &&
          name !== 'Estabelecimento não definido' &&
          name !== 'Erro ao carregar'
        )
        .filter((name, index, array) => array.indexOf(name) === index)
        .sort()

      setEstablishments(uniqueEstablishments)

    } catch (error: any) {
      console.error('Erro ao buscar gerentes:', error)
      toast.error('Erro ao carregar gerentes')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewEstablishment = async (name: string) => {
    setFormData(prev => ({ ...prev, establishment_name: name }))
    toast.success('Novo estabelecimento criado!')
  }

  // 🔥 NOVAS FUNÇÕES: Para abrir e fechar modal de detalhes
  const handleViewManager = (managerId: string) => {
    console.log('👁️ Abrindo detalhes do gerente:', managerId)
    setSelectedManagerId(managerId)
    setIsDetailModalOpen(true)
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false)
    setSelectedManagerId(null)
  }

  const handleOpenModal = async (mode: 'create' | 'edit', manager?: Manager) => {
    setModalMode(mode)
    if (mode === 'edit' && manager) {
      setSelectedManager(manager)

      // Buscar o estabelecimento atual do manager
      let currentEstablishmentName = ''
      try {
        const { data: userEst } = await supabase
          .from('user_establishments')
          .select(`
            establishment_code,
            establishment_code (
              name
            )
          `)
          .eq('user_id', manager.id)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (userEst?.establishment_code?.name) {
          currentEstablishmentName = userEst.establishment_code.name
        }
      } catch (error) {
        console.error('Erro ao buscar estabelecimento:', error)
      }

      setFormData({
        full_name: manager.full_name,
        email: manager.email,
        phone: manager.phone || '',
        establishment_name: currentEstablishmentName,
        password: '',
      })
    } else {
      setSelectedManager(null)
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        establishment_name: '',
        password: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      // Buscar clínica do usuário
      let clinicId: string | null = null

      try {
        console.log('🔍 Buscando clínica para o usuário:', profile?.id)

        const { data: userClinic, error: userClinicError } = await supabase
          .from('user_clinics')
          .select('clinic_id, clinics!inner(id, name, status)')
          .eq('user_id', profile?.id)
          .eq('clinics.status', 'active')
          .maybeSingle()

        if (userClinic?.clinic_id) {
          clinicId = userClinic.clinic_id
          console.log('✅ Clínica encontrada via user_clinics:', clinicId)
        } else {
          console.log('⚠️ user_clinics vazio, tentando buscar todas as clínicas...')

          if (profile?.role === 'clinic_admin') {
            const { data: availableClinics, error: clinicsError } = await supabase
              .from('clinics')
              .select('id, name')
              .eq('status', 'active')
              .limit(1)

            if (clinicsError) {
              throw new Error('Erro ao buscar clínicas disponíveis')
            }

            if (availableClinics && availableClinics.length > 0) {
              clinicId = availableClinics[0].id
              console.log('✅ Clínica encontrada para admin:', availableClinics[0].name)

              const { error: autoAssocError } = await supabase
                .from('user_clinics')
                .upsert({
                  user_id: profile.id,
                  clinic_id: clinicId
                }, {
                  onConflict: 'user_id,clinic_id',
                  ignoreDuplicates: true
                })

              if (autoAssocError) {
                console.warn('Aviso ao associar admin:', autoAssocError)
              } else {
                console.log('✅ Admin associado automaticamente à clínica')
              }
            }
          }
        }
      } catch (clinicSearchError) {
        console.error('Erro na busca de clínica:', clinicSearchError)
      }

      if (!clinicId && profile?.role === 'clinic_admin') {
        console.log('⚠️ Criando clínica padrão para admin...')

        const { data: newClinic, error: createClinicError } = await supabase
          .from('clinics')
          .insert({
            name: 'Clínica Principal',
            status: 'active'
          })
          .select('id, name')
          .single()

        if (createClinicError) {
          throw new Error('Não foi possível criar clínica padrão')
        }

        clinicId = newClinic.id

        await supabase
          .from('user_clinics')
          .insert({
            user_id: profile.id,
            clinic_id: clinicId
          })

        console.log('✅ Clínica criada e admin associado:', newClinic.name)
      }

      if (!clinicId) {
        throw new Error('Clínica não encontrada e não foi possível criar uma')
      }

      console.log('✅ Clínica confirmada:', clinicId)

      if (modalMode === 'create') {
        console.log('🚀 Iniciando criação de gerente...')

        const authPayload = {
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              role: 'manager'
            }
          }
        }

        console.log('📧 Criando usuário no auth:', { email: formData.email, name: formData.full_name })

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp(authPayload)

        if (signUpError) {
          console.error('❌ Erro no auth.signUp:', signUpError)
          throw signUpError
        }

        if (!signUpData.user) {
          throw new Error('Usuário não foi criado no auth')
        }

        const newUserId = signUpData.user.id
        console.log('✅ Usuário criado no auth:', newUserId)

        console.log('⏳ Aguardando propagação...')
        await new Promise(resolve => setTimeout(resolve, 2000))

        let profileCreated = false
        let retries = 3

        while (!profileCreated && retries > 0) {
          try {
            console.log(`📝 Tentativa ${4 - retries} de criar perfil...`)

            const profileData = {
              id: newUserId,
              email: formData.email,
              full_name: formData.full_name,
              phone: formData.phone || null,
              role: 'manager' as const,
              status: 'active' as const,
            }

            const { error: profileError } = await supabase
              .from('users')
              .upsert(profileData, {
                onConflict: 'id'
              })

            if (profileError) {
              console.warn(`❌ Erro na criação do perfil (tentativa ${4 - retries}):`, profileError)
              retries--
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1500))
                continue
              }
              throw profileError
            }

            profileCreated = true
            console.log('✅ Perfil criado com sucesso')
          } catch (error) {
            retries--
            if (retries === 0) {
              console.error('❌ Falha final na criação do perfil:', error)
              throw error
            }
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        }

        let clinicAssociated = false
        retries = 3

        while (!clinicAssociated && retries > 0) {
          try {
            console.log(`🏥 Tentativa ${4 - retries} de associar à clínica...`)

            const { error: clinicError } = await supabase
              .from('user_clinics')
              .upsert({
                user_id: newUserId,
                clinic_id: clinicId,
              }, {
                onConflict: 'user_id,clinic_id'
              })

            if (clinicError) {
              console.warn(`❌ Erro na associação à clínica (tentativa ${4 - retries}):`, clinicError)
              retries--
              if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000))
                continue
              }
              throw clinicError
            }

            clinicAssociated = true
            console.log('✅ Usuário associado à clínica')
          } catch (error) {
            retries--
            if (retries === 0) {
              console.error('❌ Falha final na associação à clínica:', error)
              throw error
            }
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        if (formData.establishment_name) {
          try {
            console.log('🏢 Vinculando estabelecimento:', formData.establishment_name)

            const { data: establishments, error: estError } = await supabase
              .from('establishment_codes')
              .select('code')
              .eq('name', formData.establishment_name)
              .eq('is_active', true)
              .limit(1)

            if (estError) {
              console.warn('❌ Erro ao buscar estabelecimento:', estError)
            } else if (establishments && establishments.length > 0) {
              const { error: userEstError } = await supabase
                .from('user_establishments')
                .upsert({
                  user_id: newUserId,
                  establishment_code: establishments[0].code,
                  status: 'active',
                  added_by: profile?.id
                }, {
                  onConflict: 'user_id,establishment_code'
                })

              if (userEstError) {
                console.warn('❌ Erro ao vincular estabelecimento (não crítico):', userEstError)
              } else {
                console.log('✅ Estabelecimento vinculado')
              }
            }
          } catch (estError) {
            console.warn('❌ Erro geral no estabelecimento (não crítico):', estError)
          }
        }

        console.log('🎉 Gerente criado com sucesso!')
        toast.success('Gerente criado com sucesso!')

      } else {
        // EDIÇÃO
        if (!selectedManager) return

        console.log('📝 Atualizando gerente:', selectedManager.id)

        const { error } = await supabase
          .from('users')
          .update({
            full_name: formData.full_name,
            phone: formData.phone || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedManager.id)

        if (error) throw error

        if (formData.establishment_name && formData.establishment_name !== selectedManager.establishment_name) {
          await supabase
            .from('user_establishments')
            .update({ status: 'inactive' })
            .eq('user_id', selectedManager.id)

          const { data: establishments } = await supabase
            .from('establishment_codes')
            .select('code')
            .eq('name', formData.establishment_name)
            .eq('is_active', true)
            .limit(1)

          if (establishments && establishments.length > 0) {
            await supabase
              .from('user_establishments')
              .upsert({
                user_id: selectedManager.id,
                establishment_code: establishments[0].code,
                status: 'active',
                added_by: profile?.id
              })
          }
        }

        toast.success('Gerente atualizado com sucesso!')
      }

      setIsModalOpen(false)
      setFormData({ full_name: '', email: '', phone: '', establishment_name: '', password: '' })

      setTimeout(() => fetchManagers(), 1000)

    } catch (error: any) {
      console.error('❌ Erro completo ao salvar gerente:', error)

      if (error.message.includes('User already registered')) {
        toast.error('Este email já está cadastrado no sistema')
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciais inválidas')
      } else if (error.message.includes('Clínica não encontrada')) {
        toast.error('Erro: Clínica não encontrada. Contate o suporte.')
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Email precisa ser confirmado')
      } else {
        toast.error(`Erro ao salvar gerente: ${error.message}`)
      }
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

  // Função para deletar gerente (mantida a mesma)
  const handleDeleteManager = async () => {
    if (!selectedManager) return

    try {
      setSubmitting(true)
      console.log('🗑️ Iniciando processo de remoção do gerente:', selectedManager.full_name)

      const { data: hierarchies, error: hierarchyError } = await supabase
        .from('hierarchies')
        .select('consultant_id')
        .eq('manager_id', selectedManager.id)

      if (hierarchyError) {
        console.error('Erro ao verificar hierarquias:', hierarchyError)
        throw new Error('Erro ao verificar hierarquias do gerente')
      }

      if (hierarchies && hierarchies.length > 0) {
        toast.error(`Não é possível excluir um gerente que possui ${hierarchies.length} consultor(es) associado(s). Remova os consultores primeiro.`)
        return
      }

      // Limpar dados relacionados primeiro
      console.log('🧹 Removendo comissões...')
      const { error: commissionsError } = await supabase
        .from('commissions')
        .delete()
        .eq('user_id', selectedManager.id)

      if (commissionsError) {
        console.warn('Aviso ao remover comissões:', commissionsError)
      }

      console.log('🧹 Removendo associações com estabelecimentos...')
      const { error: establishmentsError } = await supabase
        .from('user_establishments')
        .delete()
        .eq('user_id', selectedManager.id)

      if (establishmentsError) {
        console.warn('Aviso ao remover estabelecimentos:', establishmentsError)
      }

      console.log('🧹 Removendo associação com clínica...')
      const { error: clinicError } = await supabase
        .from('user_clinics')
        .delete()
        .eq('user_id', selectedManager.id)

      if (clinicError) {
        console.warn('Aviso ao remover associação com clínica:', clinicError)
      }

      console.log('🧹 Removendo perfil...')
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedManager.id)

      if (userError) {
        console.warn('Aviso ao remover perfil:', userError)
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('🔐 Removendo usuário do auth...')
      
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(selectedManager.id)
        
        if (authError) {
          console.warn('Erro no auth.deleteUser (não crítico):', authError)
          toast.success('Gerente removido do sistema! (Usuário permanece no auth, mas está inativo)')
        } else {
          console.log('✅ Usuário removido do auth com sucesso')
          toast.success('Gerente removido completamente do sistema!')
        }
      } catch (authDeleteError) {
        console.warn('Erro ao deletar do auth (não crítico):', authDeleteError)
        toast.success('Gerente removido do sistema! (Perfil limpo, mas usuário permanece no auth inativo)')
      }

      setManagers(prev => prev.filter(manager => manager.id !== selectedManager.id))
      setIsDeleteModalOpen(false)
      setSelectedManager(null)

      console.log('✅ Processo de remoção concluído')

    } catch (error: any) {
      console.error('❌ Erro ao deletar gerente:', error)
      
      if (error.message.includes('consultores')) {
        toast.error('Não é possível excluir gerente com consultores associados')
      } else if (error.message.includes('foreign key')) {
        toast.error('Gerente possui dados relacionados que impedem a exclusão')
      } else if (error.message.includes('permission')) {
        toast.error('Sem permissão para excluir este gerente')
      } else if (error.message.includes('storage')) {
        toast.error('Gerente possui arquivos no storage que devem ser removidos primeiro')
      } else {
        toast.error(`Erro ao remover gerente: ${error.message}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredManagers = managers.filter(manager => {
    const matchesSearch = !searchTerm ||
      manager.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.establishment_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = !statusFilter || manager.status === statusFilter
    const matchesEstablishment = !establishmentFilter || manager.establishment_name === establishmentFilter

    return matchesSearch && matchesStatus && matchesEstablishment
  })

  const stats = {
    total: managers.length,
    active: managers.filter(m => m.status === 'active').length,
    inactive: managers.filter(m => m.status === 'inactive').length,
    totalConsultants: managers.reduce((sum, m) => sum + m._count.consultants, 0),
    totalCommissions: managers.reduce((sum, m) => sum + m._stats.totalCommissions, 0),
    totalEstablishments: establishments.length,
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
          <h1 className="text-2xl font-bold text-secondary-900">Gerentes por Estabelecimento</h1>
          <p className="text-secondary-600">
            Gerencie todos os gerentes da clínica organizados por estabelecimento
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

      {/* Stats Cards */}
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
                <p className="text-xs font-medium text-secondary-500">Estabelecimentos</p>
                <p className="text-xs font-bold text-warning-600">{stats.totalEstablishments}</p>
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

      {/* Filters */}
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

            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('')
                setEstablishmentFilter('')
              }}
              className="btn btn-secondary"
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              Limpar Filtros
            </button>
          </div>
        </div>
      </motion.div>

      {/* Managers Table */}
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
                  <th>Estabelecimento</th>
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
                            {manager.establishment_name}
                          </div>
                          <div className="text-xs text-secondary-500">
                            Estabelecimento responsável
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
                            {manager._count.consultants}
                          </div>
                          <div className="text-xs text-secondary-500">Consultores</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-medium text-secondary-900">
                            {manager._count.leads}
                          </div>
                          <div className="text-xs text-secondary-500">Leads</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-success-600">
                          R$ {manager._stats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-secondary-500">
                          {manager._count.commissions} comissões pagas
                        </div>
                      </div>
                    </td>
                    <td>
                      {canEdit ? (
                        <select
                          value={manager.status}
                          onChange={(e) => handleStatusChange(manager.id, e.target.value)}
                          className={`badge cursor-pointer hover:opacity-80 border-0 text-xs ${manager.status === 'active' ? 'badge-success' :
                            manager.status === 'inactive' ? 'badge-danger' :
                              'badge-warning'
                            }`}
                        >
                          <option value="active">Ativo</option>
                          <option value="inactive">Inativo</option>
                          <option value="pending">Pendente</option>
                        </select>
                      ) : (
                        <span className={`badge ${manager.status === 'active' ? 'badge-success' :
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
                        {/* 🔥 NOVO: Botão para visualizar detalhes */}
                        <button
                          onClick={() => handleViewManager(manager.id)}
                          className="btn btn-ghost btn-sm"
                          title="Visualizar Detalhes"
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

      {/* 🔥 NOVO: Modal de Detalhes do Gerente */}
      <ManagerDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        managerId={selectedManagerId}
      />

      {/* Create/Edit Manager Modal (mantido igual) */}
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
                        Estabelecimento
                      </label>
                      <EstablishmentAutocomplete
                        value={formData.establishment_name}
                        onChange={(value) => setFormData(prev => ({ ...prev, establishment_name: value }))}
                        onCreateNew={handleCreateNewEstablishment}
                        placeholder="Digite para buscar ou criar novo estabelecimento..."
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
                        placeholder="email@estabelecimento.com"
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
                        !formData.establishment_name ||
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

      {/* Delete Confirmation Modal (mantido igual) */}
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-danger-600 mr-3" />
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                      Confirmar Remoção do Gerente
                    </Dialog.Title>
                  </div>

                  <div className="space-y-4">
                    <p className="text-sm text-secondary-700">
                      Tem certeza que deseja remover o gerente <strong className="text-secondary-900">{selectedManager?.full_name}</strong>?
                    </p>

                    <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-warning-800 mb-2">O que será removido:</h4>
                      <ul className="text-sm text-warning-700 space-y-1">
                        <li>• Perfil do gerente no sistema</li>
                        <li>• Todas as comissões do gerente</li>
                        <li>• Associações com estabelecimentos</li>
                        <li>• Acesso ao sistema</li>
                      </ul>
                    </div>

                    <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-danger-800 mb-2">⚠️ Atenção:</h4>
                      <ul className="text-sm text-danger-700 space-y-1">
                        <li>• Esta ação não pode ser desfeita</li>
                        <li>• Gerentes com consultores associados não podem ser removidos</li>
                        <li>• Os leads e comissões já processados serão mantidos no histórico</li>
                      </ul>
                    </div>

                    {selectedManager && (selectedManager._count?.consultants || 0) > 0 && (
                      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-red-800 mb-2">🚫 Impossível Remover</h4>
                        <p className="text-sm text-red-700">
                          Este gerente possui <strong>{selectedManager._count?.consultants || 0} consultor(es)</strong> associado(s).
                          Remova ou reatribua os consultores antes de excluir o gerente.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-secondary-200">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsDeleteModalOpen(false)}
                      disabled={submitting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={`btn ${selectedManager && selectedManager._count?.consultants > 0 ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={handleDeleteManager}
                      disabled={submitting || Boolean(selectedManager && selectedManager._count?.consultants > 0)}
                    >
                      {submitting ? (
                        <>
                          <div className="loading-spinner w-4 h-4 mr-2"></div>
                          Removendo...
                        </>
                      ) : selectedManager && selectedManager._count?.consultants > 0 ? (
                        <>
                          <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                          Não é Possível Remover
                        </>
                      ) : (
                        <>
                          <TrashIcon className="h-4 w-4 mr-2" />
                          Confirmar Remoção
                        </>
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