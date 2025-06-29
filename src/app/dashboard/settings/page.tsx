// src/app/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  CogIcon,
  CurrencyDollarIcon,
  CalculatorIcon,
  ChartBarIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  BellIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface CommissionSettings {
  id?: string
  clinic_id: string
  valor_por_arcada: number // Mudança: valor fixo por arcada
  bonus_a_cada_arcadas: number // A cada quantas arcadas ganha bônus
  valor_bonus: number // Valor do bônus
  created_at?: string
  updated_at?: string
}

interface ClinicSettings {
  id?: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('commissions')
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>({
    clinic_id: '',
    valor_por_arcada: 750.00,
    bonus_a_cada_arcadas: 7,
    valor_bonus: 750.00,
  })
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>({
    name: '',
    cnpj: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [previewArcadas, setPreviewArcadas] = useState(10)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.role === 'clinic_admin') {
      fetchSettings()
    }
  }, [profile])

  useEffect(() => {
    // Só marcar como alterado se realmente houve mudança nos valores
    const hasActualChanges =
      commissionSettings.valor_por_arcada !== 750 ||
      commissionSettings.bonus_a_cada_arcadas !== 7 ||
      commissionSettings.valor_bonus !== 750

    setHasChanges(hasActualChanges)
  }, [
    commissionSettings.valor_por_arcada,
    commissionSettings.bonus_a_cada_arcadas,
    commissionSettings.valor_bonus
  ])

  // E corrigir a função calculatePreview para ser mais robusta:
  const calculatePreview = () => {
    const arcadasVendidas = previewArcadas || 0
    const valorPorArcada = commissionSettings.valor_por_arcada || 750
    const bonusACada = commissionSettings.bonus_a_cada_arcadas || 7
    const valorBonus = commissionSettings.valor_bonus || 750

    // Calcular valor base (arcadas × valor)
    const valorBase = arcadasVendidas * valorPorArcada

    // Calcular quantos bônus ganhou
    const quantidadeBonus = bonusACada > 0 ? Math.floor(arcadasVendidas / bonusACada) : 0
    const valorTotalBonus = quantidadeBonus * valorBonus

    // Próximo bônus
    const arcadasParaProximoBonus = bonusACada > 0 ? bonusACada - (arcadasVendidas % bonusACada) : 0
    const proximoBonus = arcadasParaProximoBonus === bonusACada ? 0 : arcadasParaProximoBonus

    return {
      arcadasVendidas,
      valorPorArcada,
      valorBase,
      quantidadeBonus,
      valorTotalBonus,
      valorTotal: valorBase + valorTotalBonus,
      proximoBonus,
      proximoBonusEm: proximoBonus > 0 ? arcadasVendidas + proximoBonus : (arcadasVendidas + bonusACada)
    }
  }

  // settings/page.tsx - Função fetchSettings corrigida
  const fetchSettings = async () => {
    try {
      setLoading(true)

      // Para clinic_admin, buscar clínica de forma mais robusta
      let clinicId: string | null = null

      if (profile?.role === 'clinic_admin') {
        // Primeira tentativa: buscar via user_clinics
        const { data: userClinic, error: userClinicError } = await supabase
          .from('user_clinics')
          .select('clinic_id')
          .eq('user_id', profile.id)
          .maybeSingle()

        if (userClinic && userClinic.clinic_id) {
          clinicId = userClinic.clinic_id
          console.log('✅ Clínica encontrada via user_clinics:', clinicId)
        } else {
          console.log('⚠️ Não encontrou via user_clinics, tentando criar associação...')

          // Segunda tentativa: buscar todas as clínicas e associar o admin à primeira
          const { data: clinics, error: clinicsError } = await supabase
            .from('clinics')
            .select('id, name')
            .eq('status', 'active')
            .limit(1)

          if (clinicsError) {
            console.error('Erro ao buscar clínicas:', clinicsError)
            throw new Error('Erro ao buscar clínicas disponíveis')
          }

          if (clinics && clinics.length > 0) {
            clinicId = clinics[0].id
            console.log('✅ Clínica encontrada:', clinics[0].name)

            // Tentar associar o admin a esta clínica
            const { error: associationError } = await supabase
              .from('user_clinics')
              .upsert({
                user_id: profile.id,
                clinic_id: clinicId
              }, {
                onConflict: 'user_id,clinic_id'
              })

            if (associationError) {
              console.warn('Erro ao associar admin à clínica:', associationError)
            } else {
              console.log('✅ Admin associado à clínica automaticamente')
            }
          } else {
            // Se não tem clínicas, criar uma clínica padrão para o super admin
            console.log('⚠️ Nenhuma clínica encontrada, criando clínica padrão...')

            const { data: newClinic, error: createClinicError } = await supabase
              .from('clinics')
              .insert({
                name: 'Clínica Principal',
                status: 'active'
              })
              .select('id')
              .single()

            if (createClinicError) {
              console.error('Erro ao criar clínica padrão:', createClinicError)
              throw new Error('Erro ao criar clínica padrão')
            }

            clinicId = newClinic.id

            // Associar o admin à nova clínica
            await supabase
              .from('user_clinics')
              .insert({
                user_id: profile.id,
                clinic_id: clinicId
              })

            console.log('✅ Clínica padrão criada e admin associado')
            toast.success('Clínica principal criada automaticamente')
          }
        }
      } else {
        throw new Error('Acesso negado: apenas administradores podem acessar configurações')
      }

      if (!clinicId) {
        throw new Error('Não foi possível determinar a clínica para este usuário')
      }

      // Buscar configurações de comissão
      const { data: commissionData, error: commissionError } = await supabase
        .from('commission_settings')
        .select('*')
        .eq('clinic_id', clinicId)
        .maybeSingle()

      if (commissionError && commissionError.code !== 'PGRST116') {
        console.error('Erro ao buscar configurações de comissão:', commissionError)
        throw commissionError
      }

      if (commissionData) {
        setCommissionSettings({
          ...commissionData,
          valor_por_arcada: Number(commissionData.valor_por_arcada) || 750,
          bonus_a_cada_arcadas: Number(commissionData.bonus_a_cada_arcadas) || 7,
          valor_bonus: Number(commissionData.valor_bonus) || 750,
        })
        console.log('✅ Configurações de comissão carregadas')
      } else {
        // Se não existe configuração, usar valores padrão
        setCommissionSettings(prev => ({
          ...prev,
          clinic_id: clinicId,
          valor_por_arcada: 750,
          bonus_a_cada_arcadas: 7,
          valor_bonus: 750,
        }))
        console.log('✅ Usando configurações padrão')
      }

      // Buscar dados da clínica
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .maybeSingle()

      if (clinicError) {
        console.error('Erro ao buscar dados da clínica:', clinicError)
      } else if (clinicData) {
        setClinicSettings(clinicData)
        console.log('✅ Dados da clínica carregados:', clinicData.name)
      }

      setHasChanges(false)
      console.log('✅ Todas as configurações carregadas com sucesso')

    } catch (error: any) {
      console.error('❌ Erro ao buscar configurações:', error)

      // Mensagens de erro mais específicas
      if (error.message.includes('Acesso negado')) {
        toast.error('Acesso restrito: apenas administradores podem ver configurações')
      } else if (error.message.includes('clínica')) {
        toast.error('Problema com associação à clínica. Contate o suporte.')
      } else {
        toast.error(`Erro ao carregar configurações: ${error.message}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCommissions = async () => {
    try {
      setSaving(true)

      // Validar valores
      if (!commissionSettings.valor_por_arcada || commissionSettings.valor_por_arcada <= 0) {
        toast.error('Valor por arcada deve ser maior que zero')
        return
      }

      if (!commissionSettings.bonus_a_cada_arcadas || commissionSettings.bonus_a_cada_arcadas <= 0) {
        toast.error('Quantidade de arcadas para bônus deve ser maior que zero')
        return
      }

      if (!commissionSettings.valor_bonus || commissionSettings.valor_bonus <= 0) {
        toast.error('Valor do bônus deve ser maior que zero')
        return
      }

      if (!commissionSettings.clinic_id) {
        toast.error('ID da clínica não encontrado')
        return
      }

      const dataToSave = {
        clinic_id: commissionSettings.clinic_id,
        valor_por_arcada: Number(commissionSettings.valor_por_arcada),
        bonus_a_cada_arcadas: Number(commissionSettings.bonus_a_cada_arcadas),
        valor_bonus: Number(commissionSettings.valor_bonus),
      }

      if (commissionSettings.id) {
        // Atualizar existente
        const { error } = await supabase
          .from('commission_settings')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', commissionSettings.id)

        if (error) throw error
      } else {
        // Inserir novo
        const { data, error } = await supabase
          .from('commission_settings')
          .insert(dataToSave)
          .select()
          .single()

        if (error) throw error

        if (data) {
          setCommissionSettings(prev => ({ ...prev, ...data }))
        }
      }

      setHasChanges(false)
      toast.success('Configurações de comissão salvas com sucesso!')
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error)
      toast.error(`Erro ao salvar configurações: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Também adicione esta função de validação de entrada:
  const handleNumberInput = (value: string, field: keyof CommissionSettings) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0) {
      setCommissionSettings(prev => ({
        ...prev,
        [field]: numValue
      }))
    } else if (value === '') {
      setCommissionSettings(prev => ({
        ...prev,
        [field]: 0
      }))
    }
  }

  const handleSaveClinic = async () => {
    try {
      setSaving(true)

      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const { error } = await supabase
        .from('clinics')
        .update({
          name: clinicSettings.name,
          cnpj: clinicSettings.cnpj,
          email: clinicSettings.email,
          phone: clinicSettings.phone,
          address: clinicSettings.address,
          city: clinicSettings.city,
          state: clinicSettings.state,
          zip_code: clinicSettings.zip_code,
          updated_at: new Date().toISOString()
        })
        .eq('id', userClinic.clinic_id)

      if (error) throw error

      toast.success('Dados da clínica atualizados com sucesso!')
    } catch (error: any) {
      console.error('Erro ao salvar dados da clínica:', error)
      toast.error('Erro ao salvar dados da clínica')
    } finally {
      setSaving(false)
    }
  }

  const preview = calculatePreview()

  const tabs = [
    { id: 'commissions', name: 'Comissões', icon: CurrencyDollarIcon },
    { id: 'clinic', name: 'Dados da Clínica', icon: BuildingOfficeIcon },
    { id: 'users', name: 'Usuários', icon: UserGroupIcon },
    { id: 'notifications', name: 'Notificações', icon: BellIcon },
    { id: 'security', name: 'Segurança', icon: ShieldCheckIcon },
  ]

  if (profile?.role !== 'clinic_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
          <p className="text-secondary-500">
            Apenas administradores da clínica podem acessar as configurações.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Configurações</h1>
        <p className="text-secondary-600">
          Gerencie as configurações da sua clínica
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-secondary-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          {/* Warning Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-warning-50 border border-warning-200 rounded-lg p-4"
          >
            <div className="flex">
              <InformationCircleIcon className="h-5 w-5 text-warning-400 mr-3 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-warning-800">Sistema de Comissões por Arcadas</h3>
                <p className="text-sm text-warning-700 mt-1">
                  O sistema calcula comissões fixas por arcada vendida, com bônus progressivos.
                  As alterações afetarão apenas os novos leads convertidos.
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Settings Form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card"
            >
              <div className="card-header">
                <h3 className="text-lg font-medium text-secondary-900 flex items-center">
                  <CogIcon className="h-5 w-5 mr-2" />
                  Configurações de Comissão
                </h3>
              </div>
              <div className="card-body space-y-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Valor por Arcada
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-secondary-500 text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input pl-10"
                      value={commissionSettings.valor_por_arcada || ''}
                      onChange={(e) => handleNumberInput(e.target.value, 'valor_por_arcada')}
                      placeholder="750.00"
                    />
                  </div>
                  <p className="text-xs text-secondary-500 mt-1">
                    Valor fixo pago por cada arcada vendida
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Bônus a Cada X Arcadas
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={commissionSettings.bonus_a_cada_arcadas || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      if (!isNaN(value) && value > 0) {
                        setCommissionSettings(prev => ({
                          ...prev,
                          bonus_a_cada_arcadas: value
                        }))
                      } else if (e.target.value === '') {
                        setCommissionSettings(prev => ({
                          ...prev,
                          bonus_a_cada_arcadas: 1
                        }))
                      }
                    }}
                    placeholder="7"
                  />
                  <p className="text-xs text-secondary-500 mt-1">
                    A cada quantas arcadas o consultor ganha bônus
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Valor do Bônus
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-secondary-500 text-sm">R$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input pl-10"
                      value={commissionSettings.valor_bonus || ''}
                      onChange={(e) => handleNumberInput(e.target.value, 'valor_bonus')}
                      placeholder="750.00"
                    />
                  </div>
                  <p className="text-xs text-secondary-500 mt-1">
                    Valor adicional ganho a cada marco de arcadas
                  </p>
                </div>

                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-primary-900 mb-2">Como Funciona</h4>
                  <ul className="text-sm text-primary-700 space-y-1">
                    <li>• Cada arcada vendida = R$ {(commissionSettings.valor_por_arcada || 750).toFixed(2)}</li>
                    <li>• A cada {commissionSettings.bonus_a_cada_arcadas || 7} arcadas = +R$ {(commissionSettings.valor_bonus || 750).toFixed(2)} de bônus</li>
                    <li>• Exemplo: 7 arcadas = R$ {(7 * (commissionSettings.valor_por_arcada || 750) + (commissionSettings.valor_bonus || 750)).toFixed(2)} total</li>
                    <li>• Exemplo: 14 arcadas = R$ {(14 * (commissionSettings.valor_por_arcada || 750) + 2 * (commissionSettings.valor_bonus || 750)).toFixed(2)} total</li>
                  </ul>
                </div>

                <button
                  onClick={handleSaveCommissions}
                  disabled={saving || !hasChanges}
                  className="btn btn-primary w-full"
                >
                  {saving ? (
                    <>
                      <div className="loading-spinner w-4 h-4 mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Preview Calculator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="card-header">
                <h3 className="text-lg font-medium text-secondary-900 flex items-center">
                  <CalculatorIcon className="h-5 w-5 mr-2" />
                  Simulador de Ganhos
                </h3>
              </div>
              <div className="card-body space-y-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Quantidade de Arcadas para Simulação
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={previewArcadas}
                    onChange={(e) => setPreviewArcadas(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="bg-secondary-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-secondary-900 mb-2">Detalhamento</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Arcadas vendidas:</span>
                        <span className="font-medium">{preview.arcadasVendidas}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Valor por arcada:</span>
                        <span className="font-medium">R$ {preview.valorPorArcada.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Valor base:</span>
                        <span className="font-medium">R$ {preview.valorBase.toFixed(2)}</span>
                      </div>
                      <hr className="border-secondary-200" />
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Bônus conquistados:</span>
                        <span className="font-medium">{preview.quantidadeBonus}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary-600">Valor dos bônus:</span>
                        <span className="font-medium text-success-600">R$ {preview.valorTotalBonus.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-success-50 rounded-lg p-4 border-2 border-success-300">
                    <h4 className="text-sm font-medium text-success-900 mb-2">Total a Receber</h4>
                    <div className="text-3xl font-bold text-success-600">
                      R$ {preview.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  {preview.proximoBonus > 0 && (
                    <div className="bg-warning-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-warning-900 mb-2">Próximo Bônus</h4>
                      <p className="text-sm text-warning-700">
                        Faltam <strong>{preview.proximoBonus} arcadas</strong> para ganhar mais R$ {commissionSettings.valor_bonus.toFixed(2)} de bônus!
                      </p>
                      <p className="text-xs text-warning-600 mt-1">
                        Próximo bônus em {preview.proximoBonusEm} arcadas totais
                      </p>
                    </div>
                  )}

                  <div className="bg-primary-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-primary-900 mb-2">Marcos de Bônus</h4>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[1, 2, 3, 4, 5, 6].map(multiplicador => {
                        const arcadas = multiplicador * commissionSettings.bonus_a_cada_arcadas
                        const valor = (arcadas * commissionSettings.valor_por_arcada) + (multiplicador * commissionSettings.valor_bonus)
                        const atingido = preview.arcadasVendidas >= arcadas

                        return (
                          <div
                            key={multiplicador}
                            className={`p-2 rounded text-center ${atingido
                              ? 'bg-success-100 text-success-800 border border-success-300'
                              : 'bg-white text-secondary-600 border border-secondary-200'
                              }`}
                          >
                            <div className="font-medium">{arcadas}</div>
                            <div>R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                            {atingido && <div className="text-xs">✓</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {activeTab === 'clinic' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card max-w-2xl"
        >
          <div className="card-header">
            <h3 className="text-lg font-medium text-secondary-900 flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              Dados da Clínica
            </h3>
          </div>
          <div className="card-body space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Nome da Clínica
                </label>
                <input
                  type="text"
                  className="input"
                  value={clinicSettings.name}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  CNPJ
                </label>
                <input
                  type="text"
                  className="input"
                  value={clinicSettings.cnpj || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="input"
                  value={clinicSettings.email || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contato@clinica.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Telefone
                </label>
                <input
                  type="tel"
                  className="input"
                  value={clinicSettings.phone || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  className="input"
                  value={clinicSettings.address || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, número, bairro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  className="input"
                  value={clinicSettings.city || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Estado
                </label>
                <input
                  type="text"
                  className="input"
                  value={clinicSettings.state || ''}
                  onChange={(e) => setClinicSettings(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="SP"
                />
              </div>
            </div>

            <button
              onClick={handleSaveClinic}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  Salvar Dados da Clínica
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Outras abas (placeholder para futuras implementações) */}
      {['users', 'notifications', 'security'].includes(activeTab) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="card-body text-center py-12">
            <CogIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
            <h3 className="text-lg font-medium text-secondary-900 mb-2">
              Em Desenvolvimento
            </h3>
            <p className="text-secondary-500">
              Esta seção será implementada em breve.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  )
}