// src/components/leads/LeadConversionModal.tsx
'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
    XMarkIcon,
    CheckCircleIcon,
    CurrencyDollarIcon,
    CalculatorIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface Lead {
    id: string
    full_name: string
    email: string | null
    phone: string
    status: string
    indicated_by: string
    clinic_id: string
}

interface LeadConversionModalProps {
    isOpen: boolean
    onClose: () => void
    lead: Lead | null
    onLeadConverted?: () => void
}

interface CommissionSettings {
    valor_por_arcada: number
    bonus_a_cada_arcadas: number
    valor_bonus: number
}

export default function LeadConversionModal({
    isOpen,
    onClose,
    lead,
    onLeadConverted
}: LeadConversionModalProps) {
    const { profile } = useAuth()
    const [arcadasSelecionadas, setArcadasSelecionadas] = useState(1)
    const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
        valor_por_arcada: 750,
        bonus_a_cada_arcadas: 7,
        valor_bonus: 750
    })
    const [converting, setConverting] = useState(false)
    const [consultorStats, setConsultorStats] = useState({
        arcadas_atuais: 0,
        proximas_arcadas: 0,
        proximo_bonus_em: 0
    })
    const supabase = createClient()

    useEffect(() => {
        if (isOpen && lead) {
            fetchCommissionSettings()
            fetchConsultorStats()
        }
    }, [isOpen, lead])

    const fetchCommissionSettings = async () => {
        try {
            const { data: userClinic } = await supabase
                .from('user_clinics')
                .select('clinic_id')
                .eq('user_id', profile?.id)
                .single()

            if (!userClinic) return

            const { data: settings } = await supabase
                .from('commission_settings')
                .select('*')
                .eq('clinic_id', userClinic.clinic_id)
                .single()

            if (settings) {
                setCommissionSettings(settings)
            }
        } catch (error) {
            console.error('Erro ao buscar configurações:', error)
        }
    }

  
    // E também corrija a função fetchConsultorStats:
    const fetchConsultorStats = async () => {
        if (!lead) return

        try {
            // Buscar quantas arcadas o consultor já vendeu
            const { data: leadsConvertidos } = await supabase
                .from('leads')
                .select('arcadas_vendidas')
                .eq('indicated_by', lead.indicated_by)
                .eq('status', 'converted')

            const BONUS_A_CADA_ARCADAS = 7 // Valor fixo do sistema

            const arcadasAtuais = leadsConvertidos?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
            const proximasArcadas = arcadasAtuais + arcadasSelecionadas
            const proximoBonusEm = BONUS_A_CADA_ARCADAS - (proximasArcadas % BONUS_A_CADA_ARCADAS)

            setConsultorStats({
                arcadas_atuais: arcadasAtuais,
                proximas_arcadas: proximasArcadas,
                proximo_bonus_em: proximoBonusEm === BONUS_A_CADA_ARCADAS ? 0 : proximoBonusEm
            })
        } catch (error) {
            console.error('Erro ao buscar stats do consultor:', error)
        }
    }
    

    const handleConvert = async () => {
        if (!lead) return

        try {
            setConverting(true)

            // Valores fixos do sistema de arcadas (você pode buscar da configuração se quiser)
            const VALOR_POR_ARCADA = 750
            const BONUS_A_CADA_ARCADAS = 7
            const VALOR_BONUS = 750

            // 1. Atualizar o lead para convertido
            const { error: leadError } = await supabase
                .from('leads')
                .update({
                    status: 'converted',
                    arcadas_vendidas: arcadasSelecionadas,
                    updated_at: new Date().toISOString()
                })
                .eq('id', lead.id)

            if (leadError) throw leadError

            // 2. Calcular comissão
            const valorBase = arcadasSelecionadas * VALOR_POR_ARCADA

            // Verificar se com essas arcadas ele ganha bônus
            const arcadasTotaisAntes = consultorStats.arcadas_atuais
            const arcadasTotaisDepois = arcadasTotaisAntes + arcadasSelecionadas

            const bonusAntes = Math.floor(arcadasTotaisAntes / BONUS_A_CADA_ARCADAS)
            const bonusDepois = Math.floor(arcadasTotaisDepois / BONUS_A_CADA_ARCADAS)

            const novosBonus = bonusDepois - bonusAntes
            const valorBonus = novosBonus * VALOR_BONUS
            const valorTotal = valorBase + valorBonus

            // 3. Criar registro de comissão para o consultor
            const { error: commissionError } = await supabase
                .from('commissions')
                .insert({
                    lead_id: lead.id,
                    user_id: lead.indicated_by,
                    clinic_id: lead.clinic_id,
                    amount: valorTotal,
                    percentage: 0, // Campo obrigatório no banco, mas não usamos mais
                    type: 'consultant',
                    status: 'pending'
                })

            if (commissionError) throw commissionError

            // 4. Se o consultor tem um manager, criar comissão para o manager também
            const { data: hierarchy } = await supabase
                .from('hierarchies')
                .select('manager_id')
                .eq('consultant_id', lead.indicated_by)
                .single()

            if (hierarchy?.manager_id) {
                // Manager ganha 10% do valor do consultor
                const managerAmount = valorTotal * 0.1

                await supabase
                    .from('commissions')
                    .insert({
                        lead_id: lead.id,
                        user_id: hierarchy.manager_id,
                        clinic_id: lead.clinic_id,
                        amount: managerAmount,
                        percentage: 0, // Campo obrigatório no banco
                        type: 'manager',
                        status: 'pending'
                    })
            }

            toast.success(`Lead convertido! ${arcadasSelecionadas} arcada${arcadasSelecionadas > 1 ? 's' : ''} vendida${arcadasSelecionadas > 1 ? 's' : ''}!`)

            if (novosBonus > 0) {
                toast.success(`🎉 Consultor ganhou ${novosBonus} bônus de R$ ${VALOR_BONUS}!`, {
                    duration: 6000
                })
            }

            onClose()
            if (onLeadConverted) {
                onLeadConverted()
            }
        } catch (error: any) {
            console.error('Erro ao converter lead:', error)
            toast.error('Erro ao converter lead')
        } finally {
            setConverting(false)
        }
    }


    // E também corrija a função calculateCommission:
    const calculateCommission = () => {
        const valorBase = arcadasSelecionadas * commissionSettings.valor_por_arcada

        // Verificar se com essas arcadas ele ganha bônus
        const arcadasTotaisAntes = consultorStats.arcadas_atuais
        const arcadasTotaisDepois = arcadasTotaisAntes + arcadasSelecionadas

        const bonusAntes = Math.floor(arcadasTotaisAntes / commissionSettings.bonus_a_cada_arcadas)
        const bonusDepois = Math.floor(arcadasTotaisDepois / commissionSettings.bonus_a_cada_arcadas)

        const novosBonus = bonusDepois - bonusAntes
        const valorBonus = novosBonus * commissionSettings.valor_bonus

        return {
            valorBase,
            novosBonus,
            valorBonus,
            valorTotal: valorBase + valorBonus,
            ganhaBonus: novosBonus > 0
        }
    }

    const commission = calculateCommission()


    if (!lead) return null

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                                {/* Header */}
                                <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                                        Converter Lead
                                    </Dialog.Title>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={onClose}
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Lead Info */}
                                    <div className="bg-secondary-50 rounded-lg p-4">
                                        <h4 className="text-sm font-medium text-secondary-900 mb-2">Lead</h4>
                                        <p className="text-sm text-secondary-700">
                                            <strong>{lead.full_name}</strong>
                                        </p>
                                        <p className="text-xs text-secondary-500">
                                            {lead.phone} {lead.email && `• ${lead.email}`}
                                        </p>
                                    </div>

                                    {/* Seleção de Arcadas */}
                                    <div>
                                        <label className="block text-sm font-medium text-secondary-700 mb-2">
                                            Quantas arcadas foram vendidas?
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setArcadasSelecionadas(1)}
                                                className={`p-4 rounded-lg border-2 transition-all ${arcadasSelecionadas === 1
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                    : 'border-secondary-200 hover:border-secondary-300'
                                                    }`}
                                            >
                                                <div className="text-lg font-bold">1</div>
                                                <div className="text-xs">Arcada Superior<br />OU Inferior</div>
                                            </button>
                                            <button
                                                onClick={() => setArcadasSelecionadas(2)}
                                                className={`p-4 rounded-lg border-2 transition-all ${arcadasSelecionadas === 2
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                                    : 'border-secondary-200 hover:border-secondary-300'
                                                    }`}
                                            >
                                                <div className="text-lg font-bold">2</div>
                                                <div className="text-xs">Arcada Superior<br />E Inferior</div>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cálculo da Comissão */}
                                    <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                                        <h4 className="text-sm font-medium text-success-900 mb-3 flex items-center">
                                            <CalculatorIcon className="h-4 w-4 mr-2" />
                                            Comissão Calculada
                                        </h4>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-success-700">
                                                    {arcadasSelecionadas} arcada{arcadasSelecionadas > 1 ? 's' : ''} × R$ {commissionSettings.valor_por_arcada}
                                                </span>
                                                <span className="font-medium text-success-900">
                                                    R$ {commission.valorBase.toFixed(2)}
                                                </span>
                                            </div>

                                            {commission.ganhaBonus && (
                                                <div className="flex justify-between text-warning-700">
                                                    <span>
                                                        {commission.novosBonus} bônus × R$ {commissionSettings.valor_bonus}
                                                    </span>
                                                    <span className="font-medium">
                                                        R$ {commission.valorBonus.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}

                                            <hr className="border-success-300" />

                                            <div className="flex justify-between text-lg font-bold text-success-900">
                                                <span>Total:</span>
                                                <span>R$ {commission.valorTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status do Consultor */}
                                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                                        <h4 className="text-sm font-medium text-primary-900 mb-2">Status do Consultor</h4>
                                        <div className="text-sm text-primary-700 space-y-1">
                                            <div>Arcadas atuais: <strong>{consultorStats.arcadas_atuais}</strong></div>
                                            <div>Arcadas após venda: <strong>{consultorStats.proximas_arcadas}</strong></div>

                                            {commission.ganhaBonus ? (
                                                <div className="text-warning-700 font-medium">
                                                    🎉 Ganhará {commission.novosBonus} bônus com esta venda!
                                                </div>
                                            ) : consultorStats.proximo_bonus_em > 0 ? (
                                                <div>
                                                    Próximo bônus em: <strong>{consultorStats.proximo_bonus_em} arcadas</strong>
                                                </div>
                                            ) : (
                                                <div className="text-warning-700 font-medium">
                                                    🎉 Próximo bônus na próxima arcada!
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Aviso */}
                                    <div className="bg-warning-50 border border-warning-200 rounded-lg p-3">
                                        <div className="flex">
                                            <ExclamationTriangleIcon className="h-5 w-5 text-warning-400 mr-2 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-medium text-warning-800">Atenção</h4>
                                                <p className="text-sm text-warning-700 mt-1">
                                                    Esta ação irá marcar o lead como convertido e gerar as comissões correspondentes.
                                                    Esta operação não pode ser desfeita.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                                    <div className="flex justify-end space-x-3">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={onClose}
                                            disabled={converting}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-success"
                                            onClick={handleConvert}
                                            disabled={converting}
                                        >
                                            {converting ? (
                                                <>
                                                    <div className="loading-spinner w-4 h-4 mr-2"></div>
                                                    Convertendo...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                                                    Confirmar Conversão
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}