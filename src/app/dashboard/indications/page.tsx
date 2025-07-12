// src/app/dashboard/indications/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
    CurrencyDollarIcon,
    UserGroupIcon,
    ChartBarIcon,
    TrophyIcon,
    EyeIcon,
    ArrowTrendingUpIcon,
    StarIcon,
    LinkIcon,
    CheckCircleIcon,
    ClockIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface IndicationData {
    id: string
    original_lead: {
        id: string
        full_name: string
        phone: string
        consultant_name: string
        consultant_email: string
    }
    new_lead: {
        id: string
        full_name: string
        phone: string
        status: string
        arcadas_vendidas?: number
        converted_at?: string
    }
    commission_percentage: number
    commission_amount?: number
    created_at: string
    processed_at?: string
    created_by: {
        full_name: string
        email: string
    }
}

interface IndicationStats {
    totalIndications: number
    convertedIndications: number
    pendingIndications: number
    totalCommissionValue: number
    conversionRate: number
    averageCommissionPercentage: number
}

export default function IndicationsPage() {
    const { profile } = useAuth()
    const [indications, setIndications] = useState<IndicationData[]>([])
    const [stats, setStats] = useState<IndicationStats>({
        totalIndications: 0,
        convertedIndications: 0,
        pendingIndications: 0,
        totalCommissionValue: 0,
        conversionRate: 0,
        averageCommissionPercentage: 0,
    })
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('')
    const [searchTerm, setSearchTerm] = useState('')
    const supabase = createClient()

    useEffect(() => {
        if (profile) {
            fetchIndications()
        }
    }, [profile])

    const fetchIndications = async () => {
        try {
            setLoading(true)

            // Buscar clínica do usuário
            const { data: userClinic } = await supabase
                .from('user_clinics')
                .select('clinic_id')
                .eq('user_id', profile?.id)
                .single()

            if (!userClinic) return

            let query = supabase
                .from('lead_indications')
                .select(`
          id,
          commission_percentage,
          commission_amount,
          created_at,
          processed_at,
          original_lead:leads!lead_indications_original_lead_id_fkey (
            id,
            full_name,
            phone,
            users:indicated_by (
              full_name,
              email
            )
          ),
          new_lead:leads!lead_indications_new_lead_id_fkey (
            id,
            full_name,
            phone,
            status,
            arcadas_vendidas,
            converted_at
          ),
          created_by:users!lead_indications_created_by_fkey (
            full_name,
            email
          )
        `)
                .order('created_at', { ascending: false })

            // Filtrar por role
            if (profile?.role === 'consultant') {
                // Consultor vê apenas indicações onde ele é o consultor original
                query = query.eq('original_lead.indicated_by', profile.id)
            } else if (profile?.role === 'manager') {
                // Manager vê indicações de sua equipe
                const { data: hierarchy } = await supabase
                    .from('hierarchies')
                    .select('consultant_id')
                    .eq('manager_id', profile.id)

                const consultantIds = hierarchy?.map(h => h.consultant_id) || []
                consultantIds.push(profile.id)

                if (consultantIds.length > 0) {
                    query = query.in('original_lead.indicated_by', consultantIds)
                }
            }

            const { data, error } = await query

            if (error) throw error

            const indicationsData = data?.map(indication => ({
                id: indication.id,
                original_lead: {
                    id: indication.original_lead?.[0].id,
                    full_name: indication.original_lead?.[0].full_name,
                    phone: indication.original_lead?.[0].phone,
                    consultant_name: indication.original_lead?.[0].users?.[0]?.full_name || 'N/A',
                    consultant_email: indication.original_lead?.[0].users?.[0]?.email || 'N/A',
                },
                new_lead: {
                    id: indication.new_lead?.[0].id,
                    full_name: indication.new_lead?.[0].full_name,
                    phone: indication.new_lead?.[0].phone,
                    status: indication.new_lead?.[0].status,
                    arcadas_vendidas: indication.new_lead?.[0].arcadas_vendidas,
                    converted_at: indication.new_lead?.[0].converted_at
                },
                commission_percentage: indication.commission_percentage,
                commission_amount: indication.commission_amount,
                created_at: indication.created_at,
                processed_at: indication.processed_at,
                created_by: {
                    full_name: indication.created_by?.[0].full_name,
                    email: indication.created_by?.[0].email
                }
            })) || []

            setIndications(indicationsData)

            // Calcular estatísticas
            const totalIndications = indicationsData.length
            const convertedIndications = indicationsData.filter(i => i.new_lead.status === 'converted').length
            const pendingIndications = indicationsData.filter(i => i.new_lead.status !== 'converted' && i.new_lead.status !== 'lost').length
            const totalCommissionValue = indicationsData
                .filter(i => i.commission_amount)
                .reduce((sum, i) => sum + (i.commission_amount || 0), 0)
            const conversionRate = totalIndications > 0 ? (convertedIndications / totalIndications) * 100 : 0
            const averageCommissionPercentage = totalIndications > 0
                ? indicationsData.reduce((sum, i) => sum + i.commission_percentage, 0) / totalIndications
                : 0

            setStats({
                totalIndications,
                convertedIndications,
                pendingIndications,
                totalCommissionValue,
                conversionRate,
                averageCommissionPercentage,
            })

        } catch (error: any) {
            console.error('Erro ao buscar indicações:', error)
            toast.error('Erro ao carregar indicações')
        } finally {
            setLoading(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'converted':
                return <CheckCircleIcon className="h-4 w-4 text-success-600" />
            case 'lost':
                return <XCircleIcon className="h-4 w-4 text-danger-600" />
            default:
                return <ClockIcon className="h-4 w-4 text-warning-600" />
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'new': return 'Novo'
            case 'contacted': return 'Contatado'
            case 'scheduled': return 'Agendado'
            case 'converted': return 'Convertido'
            case 'lost': return 'Perdido'
            default: return status
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'converted': return 'success'
            case 'lost': return 'danger'
            case 'scheduled': return 'primary'
            case 'contacted': return 'warning'
            default: return 'secondary'
        }
    }

    const filteredIndications = indications.filter(indication => {
        const matchesSearch = !searchTerm ||
            indication.original_lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            indication.new_lead.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            indication.original_lead.consultant_name.toLowerCase().includes(searchTerm.toLowerCase())

        const matchesStatus = !statusFilter || indication.new_lead.status === statusFilter

        return matchesSearch && matchesStatus
    })

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
                        Relatório de Indicações
                    </h1>
                    <p className="text-secondary-600">
                        Acompanhe as indicações feitas por leads convertidos e suas comissões
                    </p>
                </div>
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
                                    <LinkIcon className="w-4 h-4 text-primary-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Total</p>
                                <p className="text-sm font-bold text-secondary-900">{stats.totalIndications}</p>
                                <p className="text-xs text-secondary-400">Indicações</p>
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
                                    <CheckCircleIcon className="w-4 h-4 text-success-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Convertidas</p>
                                <p className="text-sm font-bold text-secondary-900">{stats.convertedIndications}</p>
                                <p className="text-xs text-secondary-400">Indicações</p>
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
                                    <ClockIcon className="w-4 h-4 text-warning-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Pendentes</p>
                                <p className="text-sm font-bold text-secondary-900">{stats.pendingIndications}</p>
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
                                    <CurrencyDollarIcon className="w-4 h-4 text-success-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Comissões</p>
                                <p className="text-sm font-bold text-secondary-900">
                                    R$ {stats.totalCommissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-secondary-400">Geradas</p>
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
                                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                    <ChartBarIcon className="w-4 h-4 text-primary-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">Taxa Conversão</p>
                                <p className="text-sm font-bold text-secondary-900">
                                    {stats.conversionRate.toFixed(1)}%
                                </p>
                                <p className="text-xs text-secondary-400">Das indicações</p>
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
                                <div className="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                                    <StarIcon className="w-4 h-4 text-warning-600" />
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-xs font-medium text-secondary-500">% Médio</p>
                                <p className="text-sm font-bold text-secondary-900">
                                    {stats.averageCommissionPercentage.toFixed(1)}%
                                </p>
                                <p className="text-xs text-secondary-400">Comissão</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar por nome do lead ou consultor..."
                                className="input"
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
                            <option value="new">Novo</option>
                            <option value="contacted">Contatado</option>
                            <option value="scheduled">Agendado</option>
                            <option value="converted">Convertido</option>
                            <option value="lost">Perdido</option>
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

            {/* Indications Table */}
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
                                    <th>Lead Original</th>
                                    <th>Novo Lead</th>
                                    <th>Consultor</th>
                                    <th>% Comissão</th>
                                    <th>Status</th>
                                    <th>Valor Gerado</th>
                                    <th>Data Criação</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredIndications.map((indication) => (
                                    <tr key={indication.id}>
                                        <td>
                                            <div>
                                                <div className="font-medium text-secondary-900">
                                                    {indication.original_lead.full_name}
                                                </div>
                                                <div className="text-sm text-secondary-500">
                                                    {indication.original_lead.phone}
                                                </div>
                                                <div className="text-xs text-success-600 font-medium">
                                                    ✓ Lead convertido
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <div className="font-medium text-secondary-900">
                                                    {indication.new_lead.full_name}
                                                </div>
                                                <div className="text-sm text-secondary-500">
                                                    {indication.new_lead.phone}
                                                </div>
                                                {indication.new_lead.status === 'converted' && indication.new_lead.arcadas_vendidas && (
                                                    <div className="text-xs text-primary-600 font-medium">
                                                        {indication.new_lead.arcadas_vendidas} arcada{indication.new_lead.arcadas_vendidas > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <div className="text-sm font-medium text-secondary-900">
                                                    {indication.original_lead.consultant_name}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    {indication.original_lead.consultant_email}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-center">
                                                <div className="text-lg font-bold text-warning-600">
                                                    {indication.commission_percentage}%
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    da comissão base
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${getStatusColor(indication.new_lead.status)} flex items-center`}>
                                                {getStatusIcon(indication.new_lead.status)}
                                                <span className="ml-1">
                                                    {getStatusLabel(indication.new_lead.status)}
                                                </span>
                                            </span>
                                        </td>
                                        <td>
                                            <div className="text-center">
                                                {indication.commission_amount ? (
                                                    <div>
                                                        <div className="text-lg font-bold text-success-600">
                                                            R$ {indication.commission_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </div>
                                                        <div className="text-xs text-success-500">
                                                            Comissão gerada
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-secondary-500">
                                                        Aguardando conversão
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <div className="text-sm text-secondary-900">
                                                    {new Date(indication.created_at).toLocaleDateString('pt-BR')}
                                                </div>
                                                <div className="text-xs text-secondary-500">
                                                    por {indication.created_by.full_name}
                                                </div>
                                                {indication.processed_at && (
                                                    <div className="text-xs text-success-600">
                                                        Processado em {new Date(indication.processed_at).toLocaleDateString('pt-BR')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center space-x-2">
                                                <button className="btn btn-ghost btn-sm" title="Ver detalhes">
                                                    <EyeIcon className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredIndications.length === 0 && (
                            <div className="text-center py-12">
                                <LinkIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                                <h3 className="text-sm font-medium text-secondary-900 mb-1">
                                    {indications.length === 0 ? 'Nenhuma indicação encontrada' : 'Nenhum resultado encontrado'}
                                </h3>
                                <p className="text-sm text-secondary-500">
                                    {indications.length === 0
                                        ? 'As indicações aparecerão aqui quando leads convertidos indicarem novos clientes.'
                                        : 'Tente ajustar os filtros ou termo de busca.'
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Summary Info */}
            {stats.totalIndications > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="card"
                >
                    <div className="card-body">
                        <h3 className="text-lg font-medium text-secondary-900 mb-4">
                            Como Funcionam as Indicações
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <UserGroupIcon className="h-6 w-6 text-primary-600" />
                                </div>
                                <h4 className="font-medium text-secondary-900 mb-2">1. Lead Converte</h4>
                                <p className="text-sm text-secondary-600">
                                    Um lead é convertido e vira cliente satisfeito
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <LinkIcon className="h-6 w-6 text-warning-600" />
                                </div>
                                <h4 className="font-medium text-secondary-900 mb-2">2. Cliente Indica</h4>
                                <p className="text-sm text-secondary-600">
                                    Cliente satisfeito indica um novo lead
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <CurrencyDollarIcon className="h-6 w-6 text-success-600" />
                                </div>
                                <h4 className="font-medium text-secondary-900 mb-2">3. Comissão Especial</h4>
                                <p className="text-sm text-secondary-600">
                                    Consultor ganha percentual editável da comissão
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
                            <p className="text-sm text-primary-800">
                                <strong>💡 Dica:</strong> O percentual médio de comissão por indicação é de{' '}
                                <strong>{stats.averageCommissionPercentage.toFixed(1)}%</strong>, gerando em média{' '}
                                <strong>R$ {stats.totalCommissionValue > 0 ? (stats.totalCommissionValue / (stats.convertedIndications || 1)).toFixed(2) : '0,00'}</strong>{' '}
                                por indicação convertida.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    )
}