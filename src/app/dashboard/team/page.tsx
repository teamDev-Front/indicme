// src/app/dashboard/team/page.tsx - CORREÇÃO COMPLETA COM MODAL DE DETALHES
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
    UsersIcon,
    MagnifyingGlassIcon,
    UserPlusIcon,
    EnvelopeIcon,
    PhoneIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    FunnelIcon,
    UserMinusIcon,
    BuildingOfficeIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import Link from 'next/link'
import ConsultantDetailModal from '@/components/consultants/ConsultantDetailModal' // 🔥 IMPORTAR COMPONENTE

// Interfaces existentes (mantidas as mesmas)
interface TeamMember {
    id: string
    email: string
    full_name: string
    phone: string | null
    role: string
    status: 'active' | 'inactive' | 'pending'
    created_at: string
    updated_at: string
    hierarchy?: {
        created_at: string
    }
    _stats?: {
        totalLeads: number
        convertedLeads: number
        pendingLeads: number
        lostLeads: number
        conversionRate: number
        totalCommissions: number
        paidCommissions: number
        pendingCommissions: number
        lastLeadDate: string | null
        avgLeadsPerMonth: number
    }
}

interface TeamStats {
    totalMembers: number
    activeMembers: number
    totalLeads: number
    totalConversions: number
    teamConversionRate: number
    totalCommissions: number
    totalPaidCommissions: number
}

export default function TeamPage() {
    const { profile } = useAuth()
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [managerEstablishments, setManagerEstablishments] = useState<string[]>([])
    const [teamStats, setTeamStats] = useState<TeamStats>({
        totalMembers: 0,
        activeMembers: 0,
        totalLeads: 0,
        totalConversions: 0,
        teamConversionRate: 0,
        totalCommissions: 0,
        totalPaidCommissions: 0,
    })
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [sortBy, setSortBy] = useState<'name' | 'leads' | 'conversion' | 'commissions'>('name')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)

    // Estados para modais
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false) // 🔥 NOVO
    const [selectedConsultantId, setSelectedConsultantId] = useState<string | null>(null) // 🔥 NOVO

    const [submitting, setSubmitting] = useState(false)

    // Estado para formulário de criação
    const [newConsultantForm, setNewConsultantForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: ''
    })

    const supabase = createClient()

    useEffect(() => {
        if (profile?.role === 'manager') {
            fetchManagerEstablishments()
            fetchTeamData()
        }
    }, [profile])

    // Todas as funções existentes mantidas (fetchManagerEstablishments, fetchTeamData, etc.)
    const fetchManagerEstablishments = async () => {
        try {
            const { data: userEstablishments, error } = await supabase
                .from('user_establishments')
                .select(`
                    establishment_code,
                    establishment_code (
                        name
                    )
                `)
                .eq('user_id', profile?.id)
                .eq('status', 'active')

            if (error) throw error

            const establishmentNames = userEstablishments?.map(ue =>
                ue.establishment_code?.name || ue.establishment_code
            ).filter(Boolean) || []

            setManagerEstablishments(establishmentNames)
        } catch (error) {
            console.error('Erro ao buscar estabelecimentos do gerente:', error)
            setManagerEstablishments([])
        }
    }

    const fetchTeamData = async () => {
        try {
            setLoading(true)

            if (!profile) return

            const { data: hierarchyData, error: hierarchyError } = await supabase
                .from('hierarchies')
                .select(`
                    created_at,
                    consultant_id,
                    users!hierarchies_consultant_id_fkey (
                        id,
                        email,
                        full_name,
                        phone,
                        role,
                        status,
                        created_at,
                        updated_at
                    )
                `)
                .eq('manager_id', profile.id)

            if (hierarchyError) throw hierarchyError

            if (!hierarchyData || hierarchyData.length === 0) {
                setTeamMembers([])
                setTeamStats({
                    totalMembers: 0,
                    activeMembers: 0,
                    totalLeads: 0,
                    totalConversions: 0,
                    teamConversionRate: 0,
                    totalCommissions: 0,
                    totalPaidCommissions: 0,
                })
                setLoading(false)
                return
            }

            const teamMembersWithStats = await Promise.all(
                hierarchyData.map(async (hierarchy) => {
                    const member = hierarchy.users
                    if (!member) return null

                    const memberData = Array.isArray(member) ? member[0] : member
                    if (!memberData) return null

                    // Buscar leads do membro
                    const { data: leadsData } = await supabase
                        .from('leads')
                        .select('status, created_at, arcadas_vendidas')
                        .eq('indicated_by', memberData.id)

                    // Buscar APENAS comissões do consultor específico
                    const { data: commissionsData } = await supabase
                        .from('commissions')
                        .select('amount, status, created_at, type')
                        .eq('user_id', memberData.id)

                    const totalLeads = leadsData?.length || 0
                    const convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
                    const pendingLeads = leadsData?.filter(l => ['new', 'contacted', 'scheduled'].includes(l.status)).length || 0
                    const lostLeads = leadsData?.filter(l => l.status === 'lost').length || 0
                    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

                    // Somar TODAS as comissões do consultor
                    const totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
                    const paidCommissions = commissionsData?.filter(c => c.status === 'paid')
                        .reduce((sum, c) => sum + c.amount, 0) || 0
                    const pendingCommissions = commissionsData?.filter(c => c.status === 'pending')
                        .reduce((sum, c) => sum + c.amount, 0) || 0

                    const lastLeadDate = leadsData && leadsData.length > 0
                        ? leadsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
                        : null

                    const membershipMonths = Math.max(1, Math.floor(
                        (new Date().getTime() - new Date(hierarchy.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
                    ))
                    const avgLeadsPerMonth = totalLeads / membershipMonths

                    return {
                        ...memberData,
                        hierarchy: {
                            created_at: hierarchy.created_at
                        },
                        _stats: {
                            totalLeads,
                            convertedLeads,
                            pendingLeads,
                            lostLeads,
                            conversionRate,
                            totalCommissions,
                            paidCommissions,
                            pendingCommissions,
                            lastLeadDate,
                            avgLeadsPerMonth,
                        }
                    }
                })
            )

            const validMembers = teamMembersWithStats.filter(Boolean) as TeamMember[]
            setTeamMembers(validMembers)

            // Calcular stats da equipe
            const stats: TeamStats = {
                totalMembers: validMembers.length,
                activeMembers: validMembers.filter(m => m.status === 'active').length,
                totalLeads: validMembers.reduce((sum, m) => sum + (m._stats?.totalLeads || 0), 0),
                totalConversions: validMembers.reduce((sum, m) => sum + (m._stats?.convertedLeads || 0), 0),
                teamConversionRate: 0,
                totalCommissions: validMembers.reduce((sum, m) => sum + (m._stats?.totalCommissions || 0), 0),
                totalPaidCommissions: validMembers.reduce((sum, m) => sum + (m._stats?.paidCommissions || 0), 0),
            }

            stats.teamConversionRate = stats.totalLeads > 0 ? (stats.totalConversions / stats.totalLeads) * 100 : 0
            setTeamStats(stats)

        } catch (error: any) {
            console.error('❌ Erro ao buscar dados da equipe:', error)
            toast.error('Erro ao carregar dados da equipe')
        } finally {
            setLoading(false)
        }
    }

    const handleCreateNewConsultant = async () => {
        if (!profile) {
            toast.error('Usuário não autenticado')
            return
        }

        if (managerEstablishments.length === 0) {
            toast.error('Você não tem estabelecimentos vinculados')
            return
        }

        try {
            setSubmitting(true)

            // 1. Buscar clínica
            console.log('🔍 Buscando clínica do gerente:', profile.id)

            let clinicId: string | null = null

            const { data: userClinic, error: userClinicError } = await supabase
                .from('user_clinics')
                .select('clinic_id, clinics!inner(id, name, status)')
                .eq('user_id', profile.id)
                .eq('clinics.status', 'active')
                .maybeSingle()

            if (userClinic?.clinic_id) {
                clinicId = userClinic.clinic_id
                console.log('✅ Clínica encontrada via user_clinics:', clinicId)
            } else {
                console.log('⚠️ Não encontrou via user_clinics, buscando outras estratégias...')

                const { data: establishmentData } = await supabase
                    .from('establishment_codes')
                    .select('code')
                    .eq('name', managerEstablishments[0])
                    .single()

                if (establishmentData?.code) {
                    const { data: sameEstablishmentUsers } = await supabase
                        .from('user_establishments')
                        .select('user_id')
                        .eq('establishment_code', establishmentData.code)
                        .eq('status', 'active')
                        .limit(10)

                    if (sameEstablishmentUsers && sameEstablishmentUsers.length > 0) {
                        for (const userEst of sameEstablishmentUsers) {
                            try {
                                const { data: userClinicData } = await supabase
                                    .from('user_clinics')
                                    .select('clinic_id')
                                    .eq('user_id', userEst.user_id)
                                    .single()

                                if (userClinicData?.clinic_id) {
                                    const { data: clinicData } = await supabase
                                        .from('clinics')
                                        .select('id, status')
                                        .eq('id', userClinicData.clinic_id)
                                        .eq('status', 'active')
                                        .single()

                                    if (clinicData) {
                                        clinicId = userClinicData.clinic_id
                                        console.log('✅ Clínica encontrada via estabelecimento:', clinicId)

                                        const { error: autoAssocError } = await supabase
                                            .from('user_clinics')
                                            .upsert({
                                                user_id: profile.id,
                                                clinic_id: clinicId
                                            }, {
                                                onConflict: 'user_id,clinic_id',
                                                ignoreDuplicates: true
                                            })

                                        if (!autoAssocError) {
                                            console.log('✅ Gerente associado automaticamente à clínica')
                                        }
                                        break
                                    }
                                }
                            } catch (error) {
                                console.log(`⚠️ Erro ao verificar usuário ${userEst.user_id}:`, error)
                                continue
                            }
                        }
                    }
                }

                if (!clinicId) {
                    const { data: availableClinics, error: clinicsError } = await supabase
                        .from('clinics')
                        .select('id, name')
                        .eq('status', 'active')
                        .limit(1)

                    if (availableClinics && availableClinics.length > 0) {
                        clinicId = availableClinics[0].id
                        console.log('✅ Usando primeira clínica ativa:', clinicId)

                        await supabase
                            .from('user_clinics')
                            .upsert({
                                user_id: profile.id,
                                clinic_id: clinicId
                            })
                    }
                }

                if (!clinicId) {
                    const { data: newClinic, error: createClinicError } = await supabase
                        .from('clinics')
                        .insert({
                            name: 'Clínica Principal',
                            status: 'active'
                        })
                        .select('id')
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
                }
            }

            if (!clinicId) {
                throw new Error('Não foi possível determinar ou criar uma clínica para este gerente')
            }

            // 2. Buscar código do estabelecimento
            const { data: establishmentCode, error: estError } = await supabase
                .from('establishment_codes')
                .select('code')
                .eq('name', managerEstablishments[0])
                .single()

            if (estError || !establishmentCode) {
                throw new Error('Código do estabelecimento não encontrado.')
            }

            // 3. Criar usuário no auth
            console.log('👤 Criando usuário no auth...')
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: newConsultantForm.email,
                password: newConsultantForm.password,
                options: {
                    data: { full_name: newConsultantForm.full_name }
                }
            })

            if (signUpError) throw signUpError

            if (!signUpData.user) {
                throw new Error('Usuário não foi criado corretamente')
            }

            const newUserId = signUpData.user.id
            console.log('✅ Usuário criado no auth:', newUserId)

            // 4. Aguardar propagação
            await new Promise(resolve => setTimeout(resolve, 2000))

            // 5. Criar perfil
            const { error: profileError } = await supabase
                .from('users')
                .insert({
                    id: newUserId,
                    email: newConsultantForm.email,
                    full_name: newConsultantForm.full_name,
                    phone: newConsultantForm.phone || null,
                    role: 'consultant',
                    status: 'active',
                })

            if (profileError) {
                if (profileError.code === '23505') {
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            email: newConsultantForm.email,
                            full_name: newConsultantForm.full_name,
                            phone: newConsultantForm.phone || null,
                            role: 'consultant',
                            status: 'active',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', newUserId)

                    if (updateError) throw updateError
                } else {
                    throw profileError
                }
            }

            // 6. Associar à clínica
            const { error: clinicAssocError } = await supabase
                .from('user_clinics')
                .insert({
                    user_id: newUserId,
                    clinic_id: clinicId,
                })

            if (clinicAssocError && clinicAssocError.code !== '23505') {
                throw clinicAssocError
            }

            // 7. Criar hierarquia
            const { error: hierarchyError } = await supabase
                .from('hierarchies')
                .insert({
                    manager_id: profile.id,
                    consultant_id: newUserId,
                    clinic_id: clinicId,
                })

            if (hierarchyError && hierarchyError.code !== '23505') {
                console.warn('Erro ao criar hierarquia:', hierarchyError)
                toast.error('Consultor criado, mas não foi vinculado à sua equipe')
            }

            // 8. Vincular ao estabelecimento
            const { error: establishmentError } = await supabase
                .from('user_establishments')
                .insert({
                    user_id: newUserId,
                    establishment_code: establishmentCode.code,
                    status: 'active',
                    added_by: profile?.id
                })

            if (establishmentError) {
                console.warn('Erro ao vincular ao estabelecimento:', establishmentError)
                toast.error('Consultor criado, mas houve problema ao vincular ao estabelecimento')
            }

            toast.success(`Consultor criado e adicionado à sua equipe!`)

            // Reset form
            setNewConsultantForm({
                full_name: '',
                email: '',
                phone: '',
                password: ''
            })

            setIsAddModalOpen(false)
            await fetchTeamData()

        } catch (error: any) {
            console.error('❌ Erro ao criar consultor:', error)
            if (error.message.includes('already registered')) {
                toast.error('Este email já está cadastrado no sistema.')
            } else {
                toast.error(`Erro ao criar consultor: ${error.message}`)
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleRemoveFromTeam = async () => {
        if (!selectedMember || !profile) {
            toast.error('Dados incompletos para remover consultor')
            return
        }

        try {
            setSubmitting(true)

            const { error } = await supabase
                .from('hierarchies')
                .delete()
                .eq('manager_id', profile.id)
                .eq('consultant_id', selectedMember.id)

            if (error) throw error

            toast.success('Consultor removido da equipe com sucesso!')
            setIsRemoveModalOpen(false)
            setSelectedMember(null)
            await fetchTeamData()
        } catch (error: any) {
            console.error('Erro ao remover consultor da equipe:', error)
            toast.error('Erro ao remover consultor da equipe')
        } finally {
            setSubmitting(false)
        }
    }

    // 🔥 NOVAS FUNÇÕES: Para abrir e fechar modal de detalhes
    const handleViewConsultant = (consultantId: string) => {
        console.log('👁️ Abrindo detalhes do consultor:', consultantId)
        setSelectedConsultantId(consultantId)
        setIsDetailModalOpen(true)
    }

    const handleCloseDetailModal = () => {
        setIsDetailModalOpen(false)
        setSelectedConsultantId(null)
    }

    const handleSort = (field: typeof sortBy) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('asc')
        }
    }

    const getSortedAndFilteredMembers = () => {
        let filtered = teamMembers.filter(member => {
            const matchesSearch = !searchTerm ||
                member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                member.email.toLowerCase().includes(searchTerm.toLowerCase())

            const matchesStatus = !statusFilter || member.status === statusFilter

            return matchesSearch && matchesStatus
        })

        filtered.sort((a, b) => {
            let aValue: number | string = 0
            let bValue: number | string = 0

            switch (sortBy) {
                case 'name':
                    aValue = a.full_name.toLowerCase()
                    bValue = b.full_name.toLowerCase()
                    break
                case 'leads':
                    aValue = a._stats?.totalLeads || 0
                    bValue = b._stats?.totalLeads || 0
                    break
                case 'conversion':
                    aValue = a._stats?.conversionRate || 0
                    bValue = b._stats?.conversionRate || 0
                    break
                case 'commissions':
                    aValue = a._stats?.paidCommissions || 0
                    bValue = b._stats?.paidCommissions || 0
                    break
            }

            if (typeof aValue === 'string') {
                return sortOrder === 'asc'
                    ? aValue.localeCompare(bValue as string)
                    : (bValue as string).localeCompare(aValue)
            } else {
                return sortOrder === 'asc' ? aValue - (bValue as number) : (bValue as number) - aValue
            }
        })

        return filtered
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active': return <CheckCircleIcon className="h-4 w-4 text-success-500" />
            case 'inactive': return <XCircleIcon className="h-4 w-4 text-danger-500" />
            default: return <ClockIcon className="h-4 w-4 text-warning-500" />
        }
    }

    const getPerformanceColor = (value: number, type: 'conversion' | 'activity') => {
        if (type === 'conversion') {
            if (value >= 30) return 'text-success-600'
            if (value >= 15) return 'text-warning-600'
            return 'text-danger-600'
        } else {
            if (value >= 10) return 'text-success-600'
            if (value >= 5) return 'text-warning-600'
            return 'text-danger-600'
        }
    }

    const formatLastActivity = (dateString: string | null) => {
        if (!dateString) return 'Nunca'

        const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24))

        if (days === 0) return 'Hoje'
        if (days === 1) return 'Ontem'
        if (days <= 7) return `${days} dias atrás`
        if (days <= 30) return `${Math.floor(days / 7)} semanas atrás`
        return `${Math.floor(days / 30)} meses atrás`
    }

    if (profile?.role !== 'manager') {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
                    <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
                    <p className="text-secondary-500">
                        Apenas gerentes podem acessar esta página.
                    </p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="loading-spinner w-8 h-8"></div>
            </div>
        )
    }

    const filteredMembers = getSortedAndFilteredMembers()

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary-900">Minha Equipe</h1>
                    <p className="text-secondary-600">
                        Gerencie sua equipe de consultores e acompanhe a performance
                    </p>
                </div>

                <div className="flex space-x-3">
                    <Link href="/dashboard/consultants" className="btn btn-secondary">
                        <UsersIcon className="h-4 w-4 mr-2" />
                        Ver Todos Consultores
                    </Link>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="btn btn-primary"
                    >
                        <UserPlusIcon className="h-4 w-4 mr-2" />
                        Adicionar à Equipe
                    </button>
                </div>
            </div>

            {/* Team Stats */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-7">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="card-body">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <span className="text-sm font-bold text-primary-600">{teamStats.totalMembers}</span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Membros</p>
                                <p className="text-xs font-bold text-primary-600">
                                    R$ {teamStats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs text-secondary-400">Comissões</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Filters and Search */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="card"
            >
                <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-secondary-400" />
                            <input
                                type="text"
                                placeholder="Buscar membros..."
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
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        >
                            <option value="name">Ordenar por Nome</option>
                            <option value="leads">Ordenar por Leads</option>
                            <option value="conversion">Ordenar por Conversão</option>
                            <option value="commissions">Ordenar por Comissões</option>
                        </select>

                        <button
                            onClick={() => {
                                setSearchTerm('')
                                setStatusFilter('')
                                setSortBy('name')
                                setSortOrder('asc')
                            }}
                            className="btn btn-secondary"
                        >
                            <FunnelIcon className="h-4 w-4 mr-2" />
                            Limpar Filtros
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Team Members Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="card"
            >
                <div className="card-body p-0">
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>
                                        <button
                                            onClick={() => handleSort('name')}
                                            className="flex items-center space-x-1 text-left"
                                        >
                                            <span>Consultor</span>
                                            {sortBy === 'name' && (
                                                sortOrder === 'asc' ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />
                                            )}
                                        </button>
                                    </th>
                                    <th>Contato</th>
                                    <th>
                                        <button
                                            onClick={() => handleSort('leads')}
                                            className="flex items-center space-x-1 text-left"
                                        >
                                            <span>Performance</span>
                                            {sortBy === 'leads' && (
                                                sortOrder === 'asc' ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />
                                            )}
                                        </button>
                                    </th>
                                    <th>
                                        <button
                                            onClick={() => handleSort('conversion')}
                                            className="flex items-center space-x-1 text-left"
                                        >
                                            <span>Conversão</span>
                                            {sortBy === 'conversion' && (
                                                sortOrder === 'asc' ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />
                                            )}
                                        </button>
                                    </th>
                                    <th>
                                        <button
                                            onClick={() => handleSort('commissions')}
                                            className="flex items-center space-x-1 text-left"
                                        >
                                            <span>Comissões</span>
                                            {sortBy === 'commissions' && (
                                                sortOrder === 'asc' ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />
                                            )}
                                        </button>
                                    </th>
                                    <th>Última Atividade</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMembers.map((member) => (
                                    <tr key={member.id}>
                                        <td>
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-success-600 flex items-center justify-center">
                                                        <span className="text-sm font-medium text-white">
                                                            {member.full_name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-secondary-900">
                                                        {member.full_name}
                                                    </div>
                                                    <div className="text-sm text-secondary-500">
                                                        Na equipe desde {new Date(member.hierarchy?.created_at || member.created_at).toLocaleDateString('pt-BR')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <div className="flex items-center text-sm">
                                                    <EnvelopeIcon className="h-3 w-3 text-secondary-400 mr-1" />
                                                    {member.email}
                                                </div>
                                                {member.phone && (
                                                    <div className="flex items-center text-sm">
                                                        <PhoneIcon className="h-3 w-3 text-secondary-400 mr-1" />
                                                        {member.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="grid grid-cols-2 gap-2 text-center">
                                                <div>
                                                    <div className="text-sm font-medium text-primary-600">
                                                        {member._stats?.totalLeads || 0}
                                                    </div>
                                                    <div className="text-xs text-secondary-500">Total</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-success-600">
                                                        {member._stats?.convertedLeads || 0}
                                                    </div>
                                                    <div className="text-xs text-secondary-500">Convertidos</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-warning-600">
                                                        {member._stats?.pendingLeads || 0}
                                                    </div>
                                                    <div className="text-xs text-secondary-500">Pendentes</div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium text-danger-600">
                                                        {member._stats?.lostLeads || 0}
                                                    </div>
                                                    <div className="text-xs text-secondary-500">Perdidos</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-center">
                                                <div className={`text-lg font-bold ${getPerformanceColor(member._stats?.conversionRate || 0, 'conversion')}`}>
                                                    {(member._stats?.conversionRate || 0).toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    {(member._stats?.avgLeadsPerMonth || 0).toFixed(1)} leads/mês
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="space-y-1">
                                                <div className="text-sm font-medium text-success-600">
                                                    R$ {(member._stats?.paidCommissions || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    Total: R$ {(member._stats?.totalCommissions || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </div>
                                                {(member._stats?.pendingCommissions || 0) > 0 && (
                                                    <div className="text-xs text-warning-600">
                                                        Pendente: R$ {member._stats?.pendingCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-center">
                                                <div className="text-sm text-secondary-900">
                                                    {formatLastActivity(member._stats?.lastLeadDate ?? null)}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    Último lead
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center">
                                                {getStatusIcon(member.status)}
                                                <span className={`ml-2 badge ${member.status === 'active' ? 'badge-success' :
                                                    member.status === 'inactive' ? 'badge-danger' :
                                                        'badge-warning'
                                                    }`}>
                                                    {member.status === 'active' ? 'Ativo' :
                                                        member.status === 'inactive' ? 'Inativo' :
                                                            'Pendente'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center space-x-2">
                                                {/* 🔥 BOTÃO CORRIGIDO: Agora chama a função correta */}
                                                <button
                                                    onClick={() => handleViewConsultant(member.id)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Ver Detalhes"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedMember(member)
                                                        setIsRemoveModalOpen(true)
                                                    }}
                                                    className="btn btn-ghost btn-sm text-danger-600 hover:text-danger-700"
                                                    title="Remover da Equipe"
                                                >
                                                    <UserMinusIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredMembers.length === 0 && (
                            <div className="text-center py-12">
                                <UsersIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                                    {teamMembers.length === 0 ? 'Nenhum membro na equipe' : 'Nenhum resultado encontrado'}
                                </h3>
                                <p className="text-sm text-secondary-500">
                                    {teamMembers.length === 0
                                        ? 'Comece adicionando consultores à sua equipe.'
                                        : 'Tente ajustar os filtros ou termo de busca.'
                                    }
                                </p>
                                {teamMembers.length === 0 && (
                                    <button
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="btn btn-primary mt-4"
                                    >
                                        <UserPlusIcon className="h-4 w-4 mr-2" />
                                        Adicionar Primeiro Membro
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* 🔥 NOVO: Modal de Detalhes do Consultor */}
            <ConsultantDetailModal
                isOpen={isDetailModalOpen}
                onClose={handleCloseDetailModal}
                consultantId={selectedConsultantId}
            />

            {/* Modal de Adicionar Consultor */}
            <Transition appear show={isAddModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsAddModalOpen(false)}>
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
                                        Adicionar Consultor à Minha Equipe
                                    </Dialog.Title>

                                    {/* Info sobre estabelecimento do gerente */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                                        <div className="flex items-start">
                                            <BuildingOfficeIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-medium text-blue-900">Seu Estabelecimento</h4>
                                                <div className="text-sm text-blue-700 mt-1">
                                                    {managerEstablishments.length > 0 ? (
                                                        <span className="font-medium">{managerEstablishments[0]}</span>
                                                    ) : (
                                                        <span className="text-blue-600">Carregando...</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    O consultor será automaticamente vinculado a este estabelecimento e à sua equipe
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Formulário do Novo Consultor */}
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-secondary-900">Dados do Novo Consultor</h4>

                                        <div>
                                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                                Nome Completo *
                                            </label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={newConsultantForm.full_name}
                                                onChange={(e) => setNewConsultantForm(prev => ({ ...prev, full_name: e.target.value }))}
                                                placeholder="Nome completo do consultor"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                                    Email *
                                                </label>
                                                <input
                                                    type="email"
                                                    className="input"
                                                    value={newConsultantForm.email}
                                                    onChange={(e) => setNewConsultantForm(prev => ({ ...prev, email: e.target.value }))}
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
                                                    value={newConsultantForm.phone}
                                                    onChange={(e) => setNewConsultantForm(prev => ({ ...prev, phone: e.target.value }))}
                                                    placeholder="(11) 99999-9999"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                                                Senha Temporária *
                                            </label>
                                            <input
                                                type="password"
                                                className="input"
                                                value={newConsultantForm.password}
                                                onChange={(e) => setNewConsultantForm(prev => ({ ...prev, password: e.target.value }))}
                                                placeholder="Mínimo 6 caracteres"
                                            />
                                        </div>

                                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                            <div className="flex">
                                                <InformationCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                                                <div>
                                                    <h4 className="text-sm font-medium text-green-900">O que acontecerá:</h4>
                                                    <ul className="text-sm text-green-700 mt-1 space-y-1">
                                                        <li>• Novo consultor será criado no sistema</li>
                                                        <li>• Será automaticamente adicionado à sua equipe</li>
                                                        <li>• Será vinculado ao seu estabelecimento</li>
                                                        <li>• Receberá email com credenciais de acesso</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setIsAddModalOpen(false)
                                                setNewConsultantForm({
                                                    full_name: '',
                                                    email: '',
                                                    phone: '',
                                                    password: ''
                                                })
                                            }}
                                        >
                                            Cancelar
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleCreateNewConsultant}
                                            disabled={
                                                submitting ||
                                                !newConsultantForm.full_name ||
                                                !newConsultantForm.email ||
                                                !newConsultantForm.password ||
                                                managerEstablishments.length === 0
                                            }
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                                                    Criando...
                                                </>
                                            ) : (
                                                <>
                                                    <UserPlusIcon className="h-4 w-4 mr-2" />
                                                    Criar e Adicionar à Equipe
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

            {/* Remove Consultant Modal */}
            <Transition appear show={isRemoveModalOpen} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={() => setIsRemoveModalOpen(false)}>
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
                                        <ExclamationTriangleIcon className="h-6 w-6 text-warning-600 mr-3" />
                                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                                            Remover da Equipe
                                        </Dialog.Title>
                                    </div>

                                    <p className="text-sm text-secondary-500 mb-6">
                                        Tem certeza que deseja remover <strong>{selectedMember?.full_name}</strong> da sua equipe?
                                        O consultor continuará ativo no sistema, mas não fará mais parte da sua equipe.
                                    </p>

                                    <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 mb-4">
                                        <p className="text-sm text-warning-700">
                                            <strong>Atenção:</strong> Esta ação irá remover a hierarquia, mas não afetará os leads e comissões já existentes.
                                        </p>
                                    </div>

                                    <div className="flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => setIsRemoveModalOpen(false)}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-warning"
                                            onClick={handleRemoveFromTeam}
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                                                    Removendo...
                                                </>
                                            ) : (
                                                <>
                                                    <UserMinusIcon className="h-4 w-4 mr-2" />
                                                    Remover da Equipe
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