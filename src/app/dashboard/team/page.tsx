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

interface ConsultantOption {
    id: string
    full_name: string
    email: string
    establishment_names: string[]
    current_manager?: string
}

export default function TeamPage() {
    const { profile } = useAuth()
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [availableConsultants, setAvailableConsultants] = useState<ConsultantOption[]>([])
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
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false)
    const [selectedConsultantId, setSelectedConsultantId] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (profile?.role === 'manager') {
            fetchManagerEstablishments()
            fetchTeamData()
        }
    }, [profile])

    useEffect(() => {
        if (managerEstablishments.length > 0) {
            fetchAvailableConsultants()
        }
    }, [managerEstablishments])

    // NOVO: Buscar estabelecimentos do gerente
    const fetchManagerEstablishments = async () => {
        try {
            console.log('🔍 Buscando estabelecimentos do gerente:', profile?.id)

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
            console.log('🏢 Estabelecimentos do gerente:', establishmentNames)
        } catch (error) {
            console.error('Erro ao buscar estabelecimentos do gerente:', error)
            setManagerEstablishments([])
        }
    }

    const fetchTeamData = async () => {
        try {
            setLoading(true)

            if (!profile) return

            // Buscar membros da equipe
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

            // Verificar se hierarchyData é válido e não vazio
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

            // Buscar estatísticas para cada membro
            const teamMembersWithStats = await Promise.all(
                hierarchyData.map(async (hierarchy) => {
                    const member = hierarchy.users
                    if (!member) return null

                    // Verificar se member é um array ou objeto
                    const memberData = Array.isArray(member) ? member[0] : member
                    if (!memberData) return null

                    // Buscar leads do consultor
                    const { data: leadsData } = await supabase
                        .from('leads')
                        .select('status, created_at')
                        .eq('indicated_by', memberData.id)

                    // Buscar comissões do consultor
                    const { data: commissionsData } = await supabase
                        .from('commissions')
                        .select('amount, status, created_at')
                        .eq('user_id', memberData.id)

                    // Calcular estatísticas
                    const totalLeads = leadsData?.length || 0
                    const convertedLeads = leadsData?.filter(l => l.status === 'converted').length || 0
                    const pendingLeads = leadsData?.filter(l => ['new', 'contacted', 'scheduled'].includes(l.status)).length || 0
                    const lostLeads = leadsData?.filter(l => l.status === 'lost').length || 0
                    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0

                    const totalCommissions = commissionsData?.reduce((sum, c) => sum + c.amount, 0) || 0
                    const paidCommissions = commissionsData?.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0) || 0
                    const pendingCommissions = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0) || 0

                    // Data do último lead
                    const lastLeadDate = leadsData && leadsData.length > 0
                        ? leadsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
                        : null

                    // Média de leads por mês
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

            // Calcular estatísticas da equipe
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
            console.error('Erro ao buscar dados da equipe:', error)
            toast.error('Erro ao carregar dados da equipe')
        } finally {
            setLoading(false)
        }
    }

    // CORRIGIDO: Buscar apenas consultores dos estabelecimentos do gerente (permite primeiro consultor)
    const fetchAvailableConsultants = async () => {
        try {
            if (managerEstablishments.length === 0) {
                console.log('⚠️ Gerente não tem estabelecimentos definidos')
                setAvailableConsultants([])
                return
            }

            console.log('🔍 Buscando consultores APENAS dos estabelecimentos do gerente:', managerEstablishments)

            // 1. Buscar códigos dos estabelecimentos do gerente
            const { data: establishmentCodes, error: codesError } = await supabase
                .from('establishment_codes')
                .select('code')
                .in('name', managerEstablishments)

            if (codesError) throw codesError

            const codes = establishmentCodes?.map(ec => ec.code) || []

            if (codes.length === 0) {
                console.log('⚠️ Nenhum código encontrado para os estabelecimentos do gerente')
                setAvailableConsultants([])
                return
            }

            // 2. CORREÇÃO: Query com join correto
            const { data: consultantsInEstablishments, error: consultantsError } = await supabase
                .from('user_establishments')
                .select(`
                user_id,
                establishment_code,
                users!inner (
                    id,
                    full_name,
                    email,
                    role,
                    status
                ),
                establishment_codes!user_establishments_establishment_code_fkey (
                    name
                )
            `)
                .in('establishment_code', codes) // FILTRO PRINCIPAL: só estabelecimentos do gerente
                .eq('status', 'active')
                .eq('users.role', 'consultant')
                .eq('users.status', 'active')

            if (consultantsError) throw consultantsError

            // 3. Buscar quais consultores JÁ ESTÃO na equipe deste gerente
            const { data: currentTeamData, error: teamError } = await supabase
                .from('hierarchies')
                .select('consultant_id')
                .eq('manager_id', profile?.id)

            if (teamError) throw teamError

            const currentTeamIds = currentTeamData?.map(h => h.consultant_id) || []

            // 4. Processar todos os consultores dos estabelecimentos do gerente
            const consultantsMap = new Map()

            consultantsInEstablishments?.forEach(item => {
                const userId = item.user_id

                // Verificar se users é array ou objeto
                const userData = Array.isArray(item.users) ? item.users[0] : item.users
                if (!userData) return

                // CORREÇÃO: Acessar establishment_codes corretamente
                const establishmentData = Array.isArray(item.establishment_codes)
                    ? item.establishment_codes[0]
                    : item.establishment_codes
                const establishmentName = establishmentData?.name || 'Estabelecimento não identificado'

                // IMPORTANTE: Só incluir se o estabelecimento está na lista do gerente
                if (!managerEstablishments.includes(establishmentName)) {
                    return // Pular este consultor se não for do estabelecimento do gerente
                }

                if (!consultantsMap.has(userId)) {
                    consultantsMap.set(userId, {
                        id: userId,
                        full_name: userData.full_name,
                        email: userData.email,
                        establishment_names: [],
                        isInCurrentTeam: currentTeamIds.includes(userId) // Marcar se já está na equipe
                    })
                }

                const consultant = consultantsMap.get(userId)
                if (!consultant.establishment_names.includes(establishmentName)) {
                    consultant.establishment_names.push(establishmentName)
                }
            })

            // 5. Separar consultores disponíveis (não estão na equipe atual)
            const allConsultants = Array.from(consultantsMap.values())
            const availableConsultantsList = allConsultants.filter(c => !c.isInCurrentTeam)

            // 6. Verificar se consultores disponíveis têm outro gerente
            if (availableConsultantsList.length > 0) {
                const { data: otherManagers, error: managersError } = await supabase
                    .from('hierarchies')
                    .select(`
                consultant_id,
                users!hierarchies_manager_id_fkey (
                    full_name
                )
            `)
                    .in('consultant_id', availableConsultantsList.map(c => c.id))
                    .neq('manager_id', profile?.id)

                if (!managersError && otherManagers) {
                    otherManagers.forEach(om => {
                        const consultant = availableConsultantsList.find(c => c.id === om.consultant_id)
                        if (consultant) {
                            const managerData = Array.isArray(om.users) ? om.users[0] : om.users
                            consultant.current_manager = managerData?.full_name || 'Outro gerente'
                        }
                    })
                }
            }

            setAvailableConsultants(availableConsultantsList)
            console.log('✅ Total consultores nos estabelecimentos do gerente:', allConsultants.length)
            console.log('✅ Consultores disponíveis (não na equipe):', availableConsultantsList.length)
            console.log('✅ Consultores já na equipe:', allConsultants.filter(c => c.isInCurrentTeam).length)

        } catch (error: any) {
            console.error('❌ Erro ao buscar consultores disponíveis:', error)
            toast.error('Erro ao buscar consultores disponíveis')
            setAvailableConsultants([])
        }
    }

    // CORRIGIDO: Adicionar consultor à equipe com validações
    const handleAddConsultantToTeam = async () => {
        if (!selectedConsultantId || !profile) return

        try {
            setSubmitting(true)

            // Buscar clínica do usuário
            const { data: userClinic } = await supabase
                .from('user_clinics')
                .select('clinic_id')
                .eq('user_id', profile.id)
                .single()

            if (!userClinic) throw new Error('Clínica não encontrada')

            // Verificar se consultor já tem outro gerente
            const { data: existingHierarchy } = await supabase
                .from('hierarchies')
                .select('manager_id, users!hierarchies_manager_id_fkey(full_name)')
                .eq('consultant_id', selectedConsultantId)
                .maybeSingle()

            if (existingHierarchy) {
                // CORREÇÃO: Verificar se users é array ou objeto
                const managerData = Array.isArray(existingHierarchy.users)
                    ? existingHierarchy.users[0]
                    : existingHierarchy.users
                const managerName = managerData?.full_name || 'Outro gerente'
                toast.error(`Este consultor já está na equipe de: ${managerName}`)
                return
            }

            // Adicionar à hierarquia
            const { error } = await supabase
                .from('hierarchies')
                .insert({
                    manager_id: profile.id,
                    consultant_id: selectedConsultantId,
                    clinic_id: userClinic.clinic_id,
                })

            if (error) throw error

            toast.success('Consultor adicionado à sua equipe com sucesso!')
            setIsAddModalOpen(false)
            setSelectedConsultantId('')
            await fetchTeamData()
            await fetchAvailableConsultants()
        } catch (error: any) {
            console.error('Erro ao adicionar consultor à equipe:', error)
            toast.error('Erro ao adicionar consultor à equipe')
        } finally {
            setSubmitting(false)
        }
    }

    const handleRemoveFromTeam = async () => {
        if (!selectedMember || !profile) return

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
            await fetchAvailableConsultants()
        } catch (error: any) {
            console.error('Erro ao remover consultor da equipe:', error)
            toast.error('Erro ao remover consultor da equipe')
        } finally {
            setSubmitting(false)
        }
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

        // Aplicar ordenação
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
                                <p className="text-xs font-medium text-secondary-500">Total</p>
                                <p className="text-xs font-bold text-primary-600">
                                    R$ {teamStats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                </p>
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
                                                <Link
                                                    href={`/dashboard/consultants?search=${member.email}`}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Ver Detalhes"
                                                >
                                                    <EyeIcon className="h-4 w-4" />
                                                </Link>
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
                                {teamMembers.length === 0 && availableConsultants.length > 0 && (
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

            {/* MODAL CORRIGIDO - Add Consultant Modal */}
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
                                        Adicionar Consultor à Sua Equipe
                                    </Dialog.Title>

                                    {/* Info sobre estabelecimentos do gerente */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <div className="flex items-start">
                                            <InformationCircleIcon className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-medium text-blue-900">Seus Estabelecimentos</h4>
                                                <div className="text-sm text-blue-700 mt-1">
                                                    {managerEstablishments.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {managerEstablishments.map(est => (
                                                                <span key={est} className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                                                                    <BuildingOfficeIcon className="h-3 w-3 mr-1" />
                                                                    {est}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-blue-600">Carregando estabelecimentos...</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    Apenas consultores destes estabelecimentos podem ser adicionados à sua equipe
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {availableConsultants.length > 0 ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-secondary-700 mb-2">
                                                    Selecione um consultor
                                                </label>
                                                <select
                                                    className="input"
                                                    value={selectedConsultantId}
                                                    onChange={(e) => setSelectedConsultantId(e.target.value)}
                                                >
                                                    <option value="">Escolha um consultor...</option>
                                                    {availableConsultants.map(consultant => (
                                                        <option key={consultant.id} value={consultant.id}>
                                                            {consultant.full_name} ({consultant.email})
                                                            {consultant.current_manager && ` - Gerente: ${consultant.current_manager}`}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Detalhes do consultor selecionado */}
                                            {selectedConsultantId && (
                                                <div className="bg-secondary-50 rounded-lg p-3">
                                                    {(() => {
                                                        const selected = availableConsultants.find(c => c.id === selectedConsultantId)
                                                        if (!selected) return null
                                                        return (
                                                            <div>
                                                                <h4 className="text-sm font-medium text-secondary-900">
                                                                    {selected.full_name}
                                                                </h4>
                                                                <p className="text-xs text-secondary-600">
                                                                    Estabelecimentos: {selected.establishment_names.join(', ')}
                                                                </p>
                                                                {selected.current_manager && (
                                                                    <p className="text-xs text-warning-600 mt-1">
                                                                        ⚠️ Já tem gerente: {selected.current_manager}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )
                                                    })()}
                                                </div>
                                            )}

                                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                                                <p className="text-sm text-primary-700">
                                                    <strong>Nota:</strong> Apenas consultores dos seus estabelecimentos que não estão em outras equipes aparecem nesta lista.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <UsersIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                                            <h4 className="text-sm font-medium text-secondary-900 mb-2">
                                                Nenhum consultor disponível
                                            </h4>
                                            <div className="text-sm text-secondary-500 space-y-1">
                                                <p>Possíveis motivos:</p>
                                                <ul className="text-xs list-disc list-inside space-y-1 text-left">
                                                    <li>Todos os consultores dos seus estabelecimentos já estão na sua equipe</li>
                                                    <li>Não há consultores ativos nos seus estabelecimentos</li>
                                                    <li>Consultores estão em outras equipes</li>
                                                    <li>Você não tem estabelecimentos vinculados</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-6 flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setIsAddModalOpen(false)
                                                setSelectedConsultantId('')
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        {availableConsultants.length > 0 && (
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={handleAddConsultantToTeam}
                                                disabled={submitting || !selectedConsultantId}
                                            >
                                                {submitting ? (
                                                    <>
                                                        <div className="loading-spinner w-4 h-4 mr-2"></div>
                                                        Adicionando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlusIcon className="h-4 w-4 mr-2" />
                                                        Adicionar à Minha Equipe
                                                    </>
                                                )}
                                            </button>
                                        )}
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