'use client'

import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  CurrencyDollarIcon,
  CalculatorIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface CommissionSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  establishmentCode: string
  establishmentName: string
  onSuccess: () => void
}

interface EstablishmentCommission {
  id?: string
  establishment_code: string
  // 🔥 CORRIGIDO: Configurações do Consultor sem toggle principal
  consultant_value_per_arcada: number
  consultant_bonus_active: boolean       // 🔥 NOVO: Toggle apenas para bônus
  consultant_bonus_every_arcadas: number
  consultant_bonus_value: number
  // Configurações do Gerente - mantidas
  manager_value_per_arcada: number
  manager_bonus_active: boolean
  manager_bonus_35_arcadas: number
  manager_bonus_50_arcadas: number
  manager_bonus_75_arcadas: number
  // Metadata
  created_at?: string
  updated_at?: string
}

export default function CommissionSettingsModal({
  isOpen,
  onClose,
  establishmentCode,
  establishmentName,
  onSuccess
}: CommissionSettingsModalProps) {
  const [settings, setSettings] = useState<EstablishmentCommission>({
    establishment_code: establishmentCode,
    // 🔥 CORRIGIDO: Valores padrão para consultores
    consultant_value_per_arcada: 750,
    consultant_bonus_active: true,        // 🔥 NOVO: Bônus ativo por padrão
    consultant_bonus_every_arcadas: 7,
    consultant_bonus_value: 750,
    // Valores padrão para gerentes
    manager_value_per_arcada: 750,
    manager_bonus_active: true,
    manager_bonus_35_arcadas: 5000,
    manager_bonus_50_arcadas: 10000,
    manager_bonus_75_arcadas: 15000,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewArcadas, setPreviewArcadas] = useState(10)
  const [realArcadas, setRealArcadas] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && establishmentCode) {
      fetchExistingSettings()
      fetchRealArcadas()
    }
  }, [isOpen, establishmentCode])

  const fetchRealArcadas = async () => {
    try {
      const { data: leadsConvertidos } = await supabase
        .from('leads')
        .select('arcadas_vendidas')
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')

      const totalArcadas = leadsConvertidos?.reduce((sum, lead) => sum + (lead.arcadas_vendidas || 1), 0) || 0
      setRealArcadas(totalArcadas)
      console.log(`✅ Arcadas reais do estabelecimento ${establishmentCode}:`, totalArcadas)
    } catch (error) {
      console.error('Erro ao buscar arcadas reais:', error)
      setRealArcadas(0)
    }
  }

  const fetchExistingSettings = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (data) {
        setSettings({
          ...data,
          establishment_code: establishmentCode,
          // 🔥 CORRIGIDO: Garantir que consultant_bonus_active existe
          consultant_bonus_active: data.consultant_bonus_active !== false,
          manager_bonus_active: data.manager_bonus_active !== false,
          manager_value_per_arcada: data.manager_value_per_arcada || data.consultant_value_per_arcada || 750,
        })
      } else {
        setSettings(prev => ({
          ...prev,
          establishment_code: establishmentCode,
        }))
      }
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error)
      toast.error('Erro ao carregar configurações existentes')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // 🔥 CORRIGIDO: Validações atualizadas
      if (settings.consultant_value_per_arcada <= 0) {
        toast.error('Valor por arcada do consultor deve ser maior que zero')
        return
      }

      if (settings.manager_value_per_arcada <= 0) {
        toast.error('Valor por arcada do gerente deve ser maior que zero')
        return
      }

      if (settings.consultant_bonus_active && settings.consultant_bonus_every_arcadas <= 0) {
        toast.error('Intervalo de bônus do consultor deve ser maior que zero')
        return
      }

      if (settings.consultant_bonus_active && settings.consultant_bonus_value <= 0) {
        toast.error('Valor do bônus do consultor deve ser maior que zero')
        return
      }

      const dataToSave = {
        establishment_code: establishmentCode,
        // 🔥 CORRIGIDO: Salvar configurações do consultor (valor base sempre, bônus condicionais)
        consultant_value_per_arcada: settings.consultant_value_per_arcada,
        consultant_bonus_active: settings.consultant_bonus_active,
        consultant_bonus_every_arcadas: settings.consultant_bonus_active ? settings.consultant_bonus_every_arcadas : 0,
        consultant_bonus_value: settings.consultant_bonus_active ? settings.consultant_bonus_value : 0,
        // Configurações do gerente existentes
        manager_value_per_arcada: settings.manager_value_per_arcada,
        manager_bonus_active: settings.manager_bonus_active,
        manager_bonus_35_arcadas: settings.manager_bonus_active ? settings.manager_bonus_35_arcadas : 0,
        manager_bonus_50_arcadas: settings.manager_bonus_active ? settings.manager_bonus_50_arcadas : 0,
        manager_bonus_75_arcadas: settings.manager_bonus_active ? settings.manager_bonus_75_arcadas : 0,
      }

      if (settings.id) {
        const { error } = await supabase
          .from('establishment_commissions')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('establishment_commissions')
          .insert(dataToSave)
          .select()
          .single()

        if (error) throw error

        if (data) {
          setSettings(prev => ({ ...prev, ...data }))
        }
      }

      toast.success('Configurações de comissão salvas com sucesso!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error)
      toast.error(`Erro ao salvar configurações: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  // 🔥 CORRIGIDO: Preview do consultor sempre com valor base
  const calculateConsultantPreview = () => {
    const valorBase = previewArcadas * settings.consultant_value_per_arcada
    
    let bonusGanhos = 0
    let valorBonus = 0
    
    if (settings.consultant_bonus_active) {
      bonusGanhos = Math.floor(previewArcadas / settings.consultant_bonus_every_arcadas)
      valorBonus = bonusGanhos * settings.consultant_bonus_value
    }
    
    return {
      valorBase,
      bonusGanhos,
      valorBonus,
      valorTotal: valorBase + valorBonus
    }
  }

  const calculateManagerPreview = () => {
    const comissaoBase = previewArcadas * settings.manager_value_per_arcada

    let managerBonus = 0
    let bonus35 = 0, bonus50 = 0, bonus75 = 0
    let valor35 = 0, valor50 = 0, valor75 = 0

    if (settings.manager_bonus_active) {
      bonus35 = Math.floor(previewArcadas / 35)
      bonus50 = Math.floor(previewArcadas / 50)
      bonus75 = Math.floor(previewArcadas / 75)

      valor35 = bonus35 * settings.manager_bonus_35_arcadas
      valor50 = bonus50 * settings.manager_bonus_50_arcadas
      valor75 = bonus75 * settings.manager_bonus_75_arcadas

      managerBonus = valor35 + valor50 + valor75
    }

    return {
      comissaoBase,
      managerBonus,
      bonus35,
      bonus50,
      bonus75,
      valor35,
      valor50,
      valor75,
      valorTotal: comissaoBase + managerBonus
    }
  }

  const consultantPreview = calculateConsultantPreview()
  const managerPreview = calculateManagerPreview()

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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-secondary-200">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-secondary-900">
                    Configurar Comissões - {establishmentName}
                  </Dialog.Title>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="loading-spinner w-8 h-8"></div>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Configurações */}
                      <div className="space-y-6">
                        {/* 🔥 CORRIGIDO: Configurações do Consultor sem toggle principal */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-blue-900 flex items-center mb-4">
                            <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                            Comissões do Consultor
                          </h4>

                          <div className="space-y-4">
                            {/* 🔥 NOVO: Valor base sempre visível */}
                            <div>
                              <label className="block text-sm font-medium text-blue-800 mb-2">
                                Valor por Arcada (R$) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                value={settings.consultant_value_per_arcada}
                                onChange={(e) => setSettings(prev => ({
                                  ...prev,
                                  consultant_value_per_arcada: parseFloat(e.target.value) || 0
                                }))}
                                placeholder="750.00"
                              />
                              <p className="text-xs text-blue-600 mt-1">
                                ✅ Valor fixo pago por cada arcada vendida (sempre ativo)
                              </p>
                            </div>

                            {/* 🔥 NOVO: Seção de bônus com toggle próprio */}
                            <div className="border-t border-blue-300 pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <h5 className="text-sm font-medium text-blue-900">Bônus Progressivos</h5>
                                
                                {/* 🔥 NOVO: Toggle apenas para bônus */}
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-blue-700">Bônus:</span>
                                  <button
                                    type="button"
                                    onClick={() => setSettings(prev => ({
                                      ...prev,
                                      consultant_bonus_active: !prev.consultant_bonus_active
                                    }))}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                      settings.consultant_bonus_active ? 'bg-blue-600' : 'bg-gray-300'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        settings.consultant_bonus_active ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                  <span className="text-sm font-medium text-blue-700">
                                    {settings.consultant_bonus_active ? 'Ativo' : 'Inativo'}
                                  </span>
                                </div>
                              </div>

                              {/* 🔥 CORRIGIDO: Campos de bônus só aparecem se ativo */}
                              {settings.consultant_bonus_active ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-2">
                                      Bônus a cada X arcadas
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      className="input"
                                      value={settings.consultant_bonus_every_arcadas}
                                      onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        consultant_bonus_every_arcadas: parseInt(e.target.value) || 1
                                      }))}
                                      placeholder="7"
                                    />
                                    <p className="text-xs text-blue-600 mt-1">
                                      A cada quantas arcadas o consultor ganha bônus extra
                                    </p>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-blue-800 mb-2">
                                      Valor do Bônus (R$)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input"
                                      value={settings.consultant_bonus_value}
                                      onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        consultant_bonus_value: parseFloat(e.target.value) || 0
                                      }))}
                                      placeholder="750.00"
                                    />
                                    <p className="text-xs text-blue-600 mt-1">
                                      Valor adicional ganho a cada marco de arcadas
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-100 rounded p-3">
                                  <p className="text-sm text-gray-600">
                                    Bônus desativado. Consultor receberá apenas R$ {settings.consultant_value_per_arcada}/arcada.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Configurações do Gerente (mantidas iguais) */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-medium text-green-900 flex items-center">
                              <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                              Comissões do Gerente
                            </h4>

                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-green-700">Bônus:</span>
                              <button
                                type="button"
                                onClick={() => setSettings(prev => ({
                                  ...prev,
                                  manager_bonus_active: !prev.manager_bonus_active
                                }))}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  settings.manager_bonus_active ? 'bg-green-600' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    settings.manager_bonus_active ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                              <span className="text-sm font-medium text-green-700">
                                {settings.manager_bonus_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-green-800 mb-2">
                                Valor por Arcada do Gerente (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input"
                                value={settings.manager_value_per_arcada}
                                onChange={(e) => setSettings(prev => ({
                                  ...prev,
                                  manager_value_per_arcada: parseFloat(e.target.value) || 0
                                }))}
                                placeholder="750.00"
                              />
                              <p className="text-xs text-green-600 mt-1">
                                Valor pago por cada arcada vendida pela equipe (pode ser diferente do consultor)
                              </p>
                            </div>

                            {settings.manager_bonus_active ? (
                              <>
                                <div>
                                  <label className="block text-sm font-medium text-green-800 mb-2">
                                    Bônus a cada 35 arcadas (R$)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input"
                                    value={settings.manager_bonus_35_arcadas}
                                    onChange={(e) => setSettings(prev => ({
                                      ...prev,
                                      manager_bonus_35_arcadas: parseFloat(e.target.value) || 0
                                    }))}
                                    placeholder="5000.00"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-green-800 mb-2">
                                      Bônus 50 arcadas (R$)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input"
                                      value={settings.manager_bonus_50_arcadas}
                                      onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        manager_bonus_50_arcadas: parseFloat(e.target.value) || 0
                                      }))}
                                      placeholder="10000.00"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-green-800 mb-2">
                                      Bônus 75 arcadas (R$)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input"
                                      value={settings.manager_bonus_75_arcadas}
                                      onChange={(e) => setSettings(prev => ({
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
                                  Bônus desativado. Gerente receberá apenas R$ {settings.manager_value_per_arcada}/arcada da equipe.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Preview Calculator - ATUALIZADO */}
                      <div className="space-y-6">
                        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-secondary-900 mb-4 flex items-center">
                            <CalculatorIcon className="h-5 w-5 mr-2" />
                            Simulador de Ganhos da Equipe
                          </h4>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Arcadas convertidas pela equipe
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="200"
                              className="input"
                              value={previewArcadas}
                              onChange={(e) => setPreviewArcadas(parseInt(e.target.value) || 0)}
                            />
                          </div>

                          {/* 🔥 CORRIGIDO: Preview Consultor sempre com valor base */}
                          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 className="font-medium text-blue-900 mb-3">
                              Ganhos do Consultor {!settings.consultant_bonus_active && '(Sem Bônus)'}
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-blue-700">Valor base ({previewArcadas} arcadas):</span>
                                <span className="font-medium">R$ {consultantPreview.valorBase.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-700">Bônus ({consultantPreview.bonusGanhos}x):</span>
                                <span className="font-medium">
                                  R$ {consultantPreview.valorBonus.toLocaleString('pt-BR')}
                                  {!settings.consultant_bonus_active && <span className="text-gray-500 ml-1">(desativado)</span>}
                                </span>
                              </div>
                              <hr className="border-blue-300" />
                              <div className="flex justify-between text-lg font-bold text-blue-900">
                                <span>Total Consultor:</span>
                                <span>R$ {consultantPreview.valorTotal.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Preview Gerente (mantido igual) */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 className="font-medium text-green-900 mb-3">
                              Ganhos do Gerente {!settings.manager_bonus_active && '(Só Base)'}
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Comissão base ({previewArcadas} arcadas):</span>
                                <span className="font-medium">R$ {managerPreview.comissaoBase.toLocaleString('pt-BR')}</span>
                              </div>

                              {settings.manager_bonus_active && (
                                <>
                                  {managerPreview.bonus35 > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-green-700">Bônus 35 arcadas ({managerPreview.bonus35}x):</span>
                                      <span className="font-medium">R$ {managerPreview.valor35.toLocaleString('pt-BR')}</span>
                                    </div>
                                  )}
                                  {managerPreview.bonus50 > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-green-700">Bônus 50 arcadas ({managerPreview.bonus50}x):</span>
                                      <span className="font-medium">R$ {managerPreview.valor50.toLocaleString('pt-BR')}</span>
                                    </div>
                                  )}
                                  {managerPreview.bonus75 > 0 && (
                                    <div className="flex justify-between">
                                      <span className="text-green-700">Bônus 75 arcadas ({managerPreview.bonus75}x):</span>
                                      <span className="font-medium">R$ {managerPreview.valor75.toLocaleString('pt-BR')}</span>
                                    </div>
                                  )}
                                </>
                              )}

                              <hr className="border-green-300" />
                              <div className="flex justify-between text-lg font-bold text-green-900">
                                <span>Total Gerente:</span>
                                <span>R$ {managerPreview.valorTotal.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Total Geral - CORRIGIDO */}
                          <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
                            <div className="flex justify-between text-lg font-bold text-primary-900">
                              <span>Custo Total ({previewArcadas} arcadas):</span>
                              <span>R$ {(consultantPreview.valorTotal + managerPreview.valorTotal).toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="text-xs text-primary-600 mt-2 space-y-1">
                              <div>• Consultor sempre recebe R$ {settings.consultant_value_per_arcada}/arcada</div>
                              <div>• Bônus consultor: {settings.consultant_bonus_active ? 
                                `R$ ${settings.consultant_bonus_value} a cada ${settings.consultant_bonus_every_arcadas} arcadas` : 
                                'Desativado'
                              }</div>
                              <div>• Bônus gerente: {settings.manager_bonus_active ? 
                                'Marcos em 35, 50 e 75 arcadas' : 
                                'Desativado'
                              }</div>
                            </div>
                          </div>
                        </div>

                        {/* Status Atual - CORRIGIDO */}
                        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                          <h5 className="font-medium text-warning-900 mb-3">Status Atual do Estabelecimento</h5>
                          <div className="space-y-2 text-sm text-warning-700">
                            <div className="flex items-center">
                              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                              <span>
                                Consultor: R$ {settings.consultant_value_per_arcada}/arcada 
                                {settings.consultant_bonus_active ? 
                                  ` + bônus a cada ${settings.consultant_bonus_every_arcadas} arcadas` : 
                                  ' (sem bônus)'
                                }
                              </span>
                            </div>
                            <div className="flex items-center">
                              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
                              <span>
                                Gerente: R$ {settings.manager_value_per_arcada}/arcada da equipe
                                {settings.manager_bonus_active ?
                                  ' + marcos em 35, 50 e 75 arcadas' :
                                  ' (sem bônus)'
                                }
                              </span>
                            </div>
                            
                            {/* Arcadas reais */}
                            <div className="mt-3 p-2 bg-blue-100 border border-blue-200 rounded">
                              <p className="text-blue-800 text-xs font-medium">
                                📊 Arcadas já convertidas: {realArcadas}
                              </p>
                              {settings.manager_bonus_active && (
                                <div className="text-blue-700 text-xs mt-1">• Próximo marco gerente: {
                                  (() => {
                                    const arcadasReais = realArcadas
                                    
                                    const proximoMarco35 = 35 - (arcadasReais % 35)
                                    const proximoMarco50 = 50 - (arcadasReais % 50)
                                    const proximoMarco75 = 75 - (arcadasReais % 75)

                                    const proximosMarcos = []
                                    if (proximoMarco35 !== 35) proximosMarcos.push({ tipo: '35 arcadas', faltam: proximoMarco35 })
                                    if (proximoMarco50 !== 50) proximosMarcos.push({ tipo: '50 arcadas', faltam: proximoMarco50 })
                                    if (proximoMarco75 !== 75) proximosMarcos.push({ tipo: '75 arcadas', faltam: proximoMarco75 })

                                    if (proximosMarcos.length === 0) {
                                      return `${arcadasReais} arcadas no total. Próximo: 35 arcadas`
                                    }

                                    const menorDistancia = Math.min(...proximosMarcos.map(m => m.faltam))
                                    const proximoMarcoPrincipal = proximosMarcos.find(m => m.faltam === menorDistancia)

                                    return `${menorDistancia} arcadas para próximo bônus de ${proximoMarcoPrincipal?.tipo} (atual: ${arcadasReais})`
                                  })()
                                }</div>
                              )}
                              {settings.consultant_bonus_active && (
                                <div className="text-blue-700 text-xs mt-1">• Próximo bônus consultor: {
                                  (() => {
                                    const faltam = settings.consultant_bonus_every_arcadas - (realArcadas % settings.consultant_bonus_every_arcadas)
                                    return faltam === settings.consultant_bonus_every_arcadas ? 
                                      `${settings.consultant_bonus_every_arcadas} arcadas` :
                                      `${faltam} arcadas (atual: ${realArcadas})`
                                  })()
                                }</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="px-6 py-4 border-t border-secondary-200 bg-secondary-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                      disabled={saving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSave}
                      disabled={saving || loading}
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
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}