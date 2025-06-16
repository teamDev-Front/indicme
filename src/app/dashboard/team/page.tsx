'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
    UsersIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    UserPlusIcon,
    EnvelopeIcon,
    PhoneIcon,
    ChartBarIcon,
    EyeIcon,
    PencilIcon,
    TrashIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
    CalendarIcon,
    FunnelIcon,
    UserMinusIcon,
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
}

export default function TeamPage() {
    const { profile } = useAuth()
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [availableConsultants, setAvailableConsultants] = useState<ConsultantOption[]>([])
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
            fetchTeamData()
            fetchAvailableConsultants()
        }
    }, [profile])

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

            // Buscar estatísticas para cada membro
            // Buscar estatísticas para cada membro
            const teamMembersWithStats = await Promise.all(
                (hierarchyData || []).map(async (hierarchy) => {
                    const member = hierarchy.users
                    if (!member) return null

                    // Buscar leads do consultor
                    const { data: leadsData } = await supabase
                        .from('leads')
                        .select('status, created_at')
                        .eq('indicated_by', member && member[0].id)

                    // Buscar comissões do consultor
                    const { data: commissionsData } = await supabase
                        .from('commissions')
                        .select('amount, status, created_at')
                        .eq('user_id', member && member[0].id)

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
                        ...member,
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

            const validMembers = teamMembersWithStats.filter(Boolean) as unknown as TeamMember[]
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

    const fetchAvailableConsultants = async () => {
        try {
            // Buscar clínica do usuário
            const { data: userClinic } = await supabase
                .from('user_clinics')
                .select('clinic_id')
                .eq('user_id', profile?.id)
                .single()

            if (!userClinic) return

            // Buscar consultores que não estão em nenhuma hierarquia
            const { data: consultantsData, error } = await supabase
                .from('users')
                .select(`
          id,
          full_name,
          email,
          user_clinics!inner(clinic_id)
        `)
                .eq('user_clinics.clinic_id', userClinic.clinic_id)
                .eq('role', 'consultant')
                .eq('status', 'active')

            if (error) throw error

            // Filtrar consultores que já não estão em alguma hierarquia
            const { data: existingHierarchies } = await supabase
                .from('hierarchies')
                .select('consultant_id')
                .eq('clinic_id', userClinic.clinic_id)

            const usedConsultantIds = existingHierarchies?.map(h => h.consultant_id) || []
            const availableConsultants = consultantsData?.filter(c => !usedConsultantIds.includes(c.id)) || []

            setAvailableConsultants(availableConsultants)
        } catch (error: any) {
            console.error('Erro ao buscar consultores disponíveis:', error)
        }
    }

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

            // Adicionar à hierarquia
            const { error } = await supabase
                .from('hierarchies')
                .insert({
                    manager_id: profile.id,
                    consultant_id: selectedConsultantId,
                    clinic_id: userClinic.clinic_id,
                })

            if (error) throw error

            toast.success('Consultor adicionado à equipe com sucesso!')
            setIsAddModalOpen(false)
            setSelectedConsultantId('')
            fetchTeamData()
            fetchAvailableConsultants()
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
            fetchTeamData()
            fetchAvailableConsultants()
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
                        disabled={availableConsultants.length === 0}
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
                                <p className="text-xs text-secondary-400">Membros</p>
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
                                    <span className="text-sm font-bold text-success-600">{teamStats.activeMembers}</span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Ativos</p>
                                <p className="text-xs text-secondary-400">Membros</p>
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
                                    <span className="text-sm font-bold text-primary-600">{teamStats.totalLeads}</span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Total</p>
                                <p className="text-xs text-secondary-400">Leads</p>
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
                                    <span className="text-sm font-bold text-success-600">{teamStats.totalConversions}</span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Conversões</p>
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
                                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                                    <span className="text-sm font-bold text-warning-600">{teamStats.teamConversionRate.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Taxa</p>
                                <p className="text-xs text-secondary-400">Conversão</p>
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
                                    <CurrencyDollarIcon className="w-4 h-4 text-success-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Pago</p>
                                <p className="text-xs font-bold text-success-600">
                                    R$ {teamStats.totalPaidCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="card"
                >
                    <div className="card-body">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <CurrencyDollarIcon className="w-4 h-4 text-primary-600" />
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

            {/* Add Consultant Modal */}
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
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900 mb-4">
                                        Adicionar Consultor à Equipe
                                    </Dialog.Title>

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
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                                                <p className="text-sm text-primary-700">
                                                    <strong>Nota:</strong> Apenas consultores que não estão em nenhuma equipe aparecem nesta lista.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6">
                                            <UsersIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                                            <h4 className="text-sm font-medium text-secondary-900 mb-2">
                                                Nenhum consultor disponível
                                            </h4>
                                            <p className="text-sm text-secondary-500">
                                                Todos os consultores já estão em equipes ou não há consultores cadastrados.
                                            </p>
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
                                                        Adicionar à Equipe
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