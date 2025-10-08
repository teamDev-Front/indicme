// src/app/dashboard/settings/page.tsx - VERSÃO CORRIGIDA
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { motion } from 'framer-motion'
import {
  CurrencyDollarIcon,
  BuildingOfficeIcon,
  Cog6ToothIcon,
  BellIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface EstablishmentCommission {
  id: string
  establishment_code: string
  consultant_value_per_arcada: number
  consultant_bonus_every_arcadas: number
  consultant_bonus_value: number
  manager_value_per_arcada: number
  manager_bonus_35_arcadas: number
  manager_bonus_50_arcadas: number
  manager_bonus_75_arcadas: number
  consultant_active: boolean // 🔥 CORRIGIDO: Nome correto da coluna
  manager_bonus_active: boolean
  establishment_codes?: {
    name: string
    code: string
  }
}

interface CommissionSettings {
  consultantValuePerArcada: number
  consultantBonusEveryArcadas: number
  consultantBonusValue: number
  managerValuePerArcada: number
  managerBonus35: number
  managerBonus50: number
  managerBonus75: number
  consultantBonusActive: boolean // 🔥 CORRIGIDO
  managerBonusActive: boolean
}

export default function SettingsPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('commissions')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [establishments, setEstablishments] = useState<EstablishmentCommission[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<string>('')
  const [settings, setSettings] = useState<CommissionSettings>({
    consultantValuePerArcada: 750,
    consultantBonusEveryArcadas: 7,
    consultantBonusValue: 750,
    managerValuePerArcada: 75,
    managerBonus35: 5000,
    managerBonus50: 10000,
    managerBonus75: 15000,
    consultantBonusActive: true, // 🔥 CORRIGIDO
    managerBonusActive: true,
  })

  const supabase = createClient()

  const tabs = [
    { id: 'commissions', name: 'Comissões', icon: CurrencyDollarIcon },
    { id: 'establishments', name: 'Estabelecimentos', icon: BuildingOfficeIcon },
    { id: 'general', name: 'Geral', icon: Cog6ToothIcon },
    { id: 'notifications', name: 'Notificações', icon: BellIcon },
  ]

  useEffect(() => {
    if (profile?.role === 'clinic_admin') {
      fetchEstablishments()
    } else {
      setLoading(false)
    }
  }, [profile])

  const fetchEstablishments = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('establishment_commissions')
        .select(`
          *,
          establishment_codes (
            name,
            code
          )
        `)
        .order('establishment_code')

      if (error) throw error

      console.log('📊 Estabelecimentos carregados:', data)
      setEstablishments(data || [])

      // Selecionar primeiro estabelecimento por padrão
      if (data && data.length > 0) {
        setSelectedEstablishment(data[0].establishment_code)
        loadSettingsFromEstablishment(data[0])
      }

    } catch (error) {
      console.error('Erro ao carregar estabelecimentos:', error)
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const loadSettingsFromEstablishment = (establishment: EstablishmentCommission) => {
    setSettings({
      consultantValuePerArcada: establishment.consultant_value_per_arcada,
      consultantBonusEveryArcadas: establishment.consultant_bonus_every_arcadas,
      consultantBonusValue: establishment.consultant_bonus_value,
      managerValuePerArcada: establishment.manager_value_per_arcada,
      managerBonus35: establishment.manager_bonus_35_arcadas,
      managerBonus50: establishment.manager_bonus_50_arcadas,
      managerBonus75: establishment.manager_bonus_75_arcadas,
      consultantBonusActive: establishment.consultant_active ?? true, // 🔥 CORRIGIDO
      managerBonusActive: establishment.manager_bonus_active ?? true,
    })
  }

  const handleEstablishmentChange = (code: string) => {
    setSelectedEstablishment(code)
    const establishment = establishments.find(e => e.establishment_code === code)
    if (establishment) {
      loadSettingsFromEstablishment(establishment)
    }
  }

  const handleSaveSettings = async () => {
    if (!selectedEstablishment) {
      toast.error('Selecione um estabelecimento')
      return
    }

    try {
      setSaving(true)
      console.log('💾 Salvando configurações para:', selectedEstablishment)

      // 🔥 CORRIGIDO: Usar nomes corretos das colunas
      const { error } = await supabase
        .from('establishment_commissions')
        .update({
          consultant_value_per_arcada: settings.consultantValuePerArcada,
          consultant_bonus_every_arcadas: settings.consultantBonusEveryArcadas,
          consultant_bonus_value: settings.consultantBonusValue,
          manager_value_per_arcada: settings.managerValuePerArcada,
          manager_bonus_35_arcadas: settings.managerBonus35,
          manager_bonus_50_arcadas: settings.managerBonus50,
          manager_bonus_75_arcadas: settings.managerBonus75,
          consultant_active: settings.consultantBonusActive, // 🔥 CORRIGIDO
          manager_bonus_active: settings.managerBonusActive,
          updated_at: new Date().toISOString(),
        })
        .eq('establishment_code', selectedEstablishment)

      if (error) throw error

      toast.success('Configurações salvas com sucesso!')
      console.log('✅ Configurações salvas')

      // Recarregar dados
      await fetchEstablishments()

    } catch (error: any) {
      console.error('❌ Erro ao salvar:', error)
      toast.error(`Erro ao salvar: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Simulador de ganhos
  const simulateEarnings = (arcadas: number) => {
    const consultantBase = arcadas * settings.consultantValuePerArcada
    
    let consultantBonus = 0
    if (settings.consultantBonusActive) {
      const bonusCount = Math.floor(arcadas / settings.consultantBonusEveryArcadas)
      consultantBonus = bonusCount * settings.consultantBonusValue
    }

    const consultantTotal = consultantBase + consultantBonus

    const managerBase = arcadas * settings.managerValuePerArcada
    
    let managerBonus = 0
    if (settings.managerBonusActive) {
      if (arcadas >= 75) managerBonus = settings.managerBonus75
      else if (arcadas >= 50) managerBonus = settings.managerBonus50
      else if (arcadas >= 35) managerBonus = settings.managerBonus35
    }

    const managerTotal = managerBase + managerBonus

    return {
      consultant: {
        base: consultantBase,
        bonus: consultantBonus,
        total: consultantTotal,
      },
      manager: {
        base: managerBase,
        bonus: managerBonus,
        total: managerTotal,
      },
      total: consultantTotal + managerTotal,
    }
  }

  if (profile?.role !== 'clinic_admin' && profile?.role !== 'clinic_viewer') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-warning-400 mb-4" />
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
          <p className="text-secondary-500">
            Apenas administradores podem acessar as configurações.
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
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
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

          {/* Seleção de Estabelecimento */}
          <div className="card">
            <div className="card-body">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-secondary-900">
                  Selecione o Estabelecimento
                </h3>
                <BuildingOfficeIcon className="h-5 w-5 text-primary-600" />
              </div>
              
              <select
                value={selectedEstablishment}
                onChange={(e) => handleEstablishmentChange(e.target.value)}
                className="input"
              >
                <option value="">Selecione um estabelecimento</option>
                {establishments.map((est) => (
                  <option key={est.establishment_code} value={est.establishment_code}>
                    {est.establishment_codes?.name || est.establishment_code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedEstablishment && (
            <>
              {/* Comissões do Consultor */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
              >
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 text-primary-600 mr-2" />
                      <h3 className="text-lg font-semibold text-secondary-900">
                        Comissões do Consultor
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Valor por Arcada */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Valor por Arcada (R$) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settings.consultantValuePerArcada}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          consultantValuePerArcada: parseFloat(e.target.value) || 0
                        }))}
                        className="input"
                        placeholder="750.00"
                      />
                      <p className="text-xs text-success-600 mt-1 flex items-center">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Valor fixo pago por cada arcada vendida (sempre ativo)
                      </p>
                    </div>

                    {/* Bônus Progressivos */}
                    <div className="bg-primary-50 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-secondary-900">
                          Bônus Progressivos
                        </label>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-secondary-600">
                            Bônus: {settings.consultantBonusActive ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSettings(prev => ({
                              ...prev,
                              consultantBonusActive: !prev.consultantBonusActive
                            }))}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              settings.consultantBonusActive ? 'bg-primary-600' : 'bg-secondary-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                settings.consultantBonusActive ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {!settings.consultantBonusActive && (
                        <p className="text-sm text-secondary-600 bg-secondary-100 rounded p-3">
                          Bônus desativado. Consultor receberá apenas R$ {settings.consultantValuePerArcada}/arcada.
                        </p>
                      )}

                      {settings.consultantBonusActive && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Bônus a cada quantas arcadas?
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={settings.consultantBonusEveryArcadas}
                                onChange={(e) => setSettings(prev => ({
                                  ...prev,
                                  consultantBonusEveryArcadas: parseInt(e.target.value) || 1
                                }))}
                                className="input"
                                placeholder="7"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-secondary-700 mb-2">
                                Valor do Bônus (R$)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={settings.consultantBonusValue}
                                onChange={(e) => setSettings(prev => ({
                                  ...prev,
                                  consultantBonusValue: parseFloat(e.target.value) || 0
                                }))}
                                className="input"
                                placeholder="750.00"
                              />
                            </div>
                          </div>

                          <p className="text-xs text-primary-600">
                            📊 Exemplo: A cada {settings.consultantBonusEveryArcadas} arcadas vendidas, 
                            o consultor ganha um bônus de R$ {settings.consultantBonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Comissões do Gerente */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
              >
                <div className="card-body">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="h-5 w-5 text-success-600 mr-2" />
                      <h3 className="text-lg font-semibold text-secondary-900">
                        Comissões do Gerente
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-secondary-600">
                        Bônus: {settings.managerBonusActive ? 'Ativo' : 'Inativo'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          managerBonusActive: !prev.managerBonusActive
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.managerBonusActive ? 'bg-success-600' : 'bg-secondary-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.managerBonusActive ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Valor por Arcada do Gerente */}
                    <div>
                      <label className="block text-sm font-medium text-secondary-700 mb-2">
                        Valor por Arcada do Gerente (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settings.managerValuePerArcada}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          managerValuePerArcada: parseFloat(e.target.value) || 0
                        }))}
                        className="input"
                        placeholder="75.00"
                      />
                      <p className="text-xs text-success-600 mt-1">
                        Valor pago por cada arcada vendida pela equipe (pode ser diferente do consultor)
                      </p>
                    </div>

                    {/* Bônus do Gerente */}
                    {!settings.managerBonusActive && (
                      <div className="bg-secondary-100 rounded-lg p-4">
                        <p className="text-sm text-secondary-600">
                          Bônus desativado. Gerente receberá apenas R$ {settings.managerValuePerArcada}/arcada da equipe.
                        </p>
                      </div>
                    )}

                    {settings.managerBonusActive && (
                      <div className="bg-success-50 rounded-lg p-4 space-y-4">
                        <label className="block text-sm font-medium text-secondary-900 mb-3">
                          Bônus por Metas de Arcadas da Equipe
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-secondary-600 mb-2">
                              35 Arcadas (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={settings.managerBonus35}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                managerBonus35: parseFloat(e.target.value) || 0
                              }))}
                              className="input"
                              placeholder="5000.00"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-secondary-600 mb-2">
                              50 Arcadas (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={settings.managerBonus50}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                managerBonus50: parseFloat(e.target.value) || 0
                              }))}
                              className="input"
                              placeholder="10000.00"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-secondary-600 mb-2">
                              75 Arcadas (R$)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={settings.managerBonus75}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                managerBonus75: parseFloat(e.target.value) || 0
                              }))}
                              className="input"
                              placeholder="15000.00"
                            />
                          </div>
                        </div>

                        <p className="text-xs text-success-600">
                          📊 Bônus únicos quando a equipe atinge as metas de arcadas vendidas
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Simulador de Ganhos */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card"
              >
                <div className="card-header">
                  <h3 className="text-lg font-medium text-secondary-900">
                    📊 Simulador de Ganhos da Equipe
                  </h3>
                </div>
                <div className="card-body">
                  <SimulatorSection settings={settings} />
                </div>
              </motion.div>

              {/* Botão Salvar */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={saving || profile?.role !== 'clinic_admin'}
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
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Outras tabs (placeholder) */}
      {activeTab === 'establishments' && (
        <div className="card">
          <div className="card-body">
            <p className="text-secondary-600">
              Configurações de estabelecimentos em desenvolvimento...
            </p>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="card">
          <div className="card-body">
            <p className="text-secondary-600">
              Configurações gerais em desenvolvimento...
            </p>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card">
          <div className="card-body">
            <p className="text-secondary-600">
              Configurações de notificações em desenvolvimento...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente Simulador
function SimulatorSection({ settings }: { settings: CommissionSettings }) {
  const [arcadas, setArcadas] = useState(10)

  const simulate = (arcadas: number) => {
    const consultantBase = arcadas * settings.consultantValuePerArcada
    
    let consultantBonus = 0
    if (settings.consultantBonusActive) {
      const bonusCount = Math.floor(arcadas / settings.consultantBonusEveryArcadas)
      consultantBonus = bonusCount * settings.consultantBonusValue
    }

    const consultantTotal = consultantBase + consultantBonus

    const managerBase = arcadas * settings.managerValuePerArcada
    
    let managerBonus = 0
    if (settings.managerBonusActive) {
      if (arcadas >= 75) managerBonus = settings.managerBonus75
      else if (arcadas >= 50) managerBonus = settings.managerBonus50
      else if (arcadas >= 35) managerBonus = settings.managerBonus35
    }

    const managerTotal = managerBase + managerBonus

    return {
      consultant: { base: consultantBase, bonus: consultantBonus, total: consultantTotal },
      manager: { base: managerBase, bonus: managerBonus, total: managerTotal },
      total: consultantTotal + managerTotal,
    }
  }

  const result = simulate(arcadas)

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary-700 mb-2">
          Arcadas convertidas pela equipe
        </label>
        <input
          type="number"
          min="1"
          value={arcadas}
          onChange={(e) => setArcadas(parseInt(e.target.value) || 1)}
          className="input max-w-xs"
          placeholder="10"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ganhos do Consultor */}
        <div className="bg-primary-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-primary-900 mb-3">
            Ganhos do Consultor (Sem Bônus)
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-primary-700">Valor base ({arcadas} arcadas):</span>
              <span className="font-bold text-primary-900">
                R$ {result.consultant.base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-700">
                Bônus ({Math.floor(arcadas / settings.consultantBonusEveryArcadas)}x):
              </span>
              <span className="font-bold text-primary-900">
                R$ {result.consultant.bonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {!settings.consultantBonusActive && ' (desativado)'}
              </span>
            </div>
            <div className="pt-2 border-t border-primary-200 flex justify-between">
              <span className="font-semibold text-primary-900">Total Consultor:</span>
              <span className="font-bold text-lg text-primary-600">
                R$ {result.consultant.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Ganhos do Gerente */}
        <div className="bg-success-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-success-900 mb-3">
            Ganhos do Gerente (Só Base)
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-success-700">Comissão base ({arcadas} arcadas):</span>
              <span className="font-bold text-success-900">
                R$ {result.manager.base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-success-700">Bônus por meta:</span>
              <span className="font-bold text-success-900">
                R$ {result.manager.bonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {!settings.managerBonusActive && ' (desativado)'}
              </span>
            </div>
            <div className="pt-2 border-t border-success-200 flex justify-between">
              <span className="font-semibold text-success-900">Total Gerente:</span>
              <span className="font-bold text-lg text-success-600">
                R$ {result.manager.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Custo Total */}
      <div className="bg-secondary-100 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-base font-semibold text-secondary-900">
            Custo Total ({arcadas} arcadas):
          </span>
          <span className="text-2xl font-bold text-secondary-900">
            R$ {result.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <ul className="mt-3 text-xs text-secondary-600 space-y-1">
          <li>• Consultor sempre recebe R$ {settings.consultantValuePerArcada}/arcada</li>
          {settings.consultantBonusActive && (
            <li>• Bônus consultor: Desativado nesta simulação (apenas arcadas fixas)</li>
          )}
          {settings.managerBonusActive && (
            <li>• Bônus gerente: {arcadas >= 35 ? 'Ativado' : 'Desativado'} ({arcadas} arcadas)</li>
          )}
        </ul>
      </div>
    </div>
  )
}