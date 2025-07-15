// src/app/dashboard/establishments/page.tsx - ATUALIZADO com comissões independentes para consultor e gerente

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
  // Configurações do Consultor
  consultant_value_per_arcada: number
  consultant_bonus_every_arcadas: number
  consultant_bonus_value: number
  // Configurações do Gerente - ATUALIZADO com valor independente
  manager_value_per_arcada: number // 🔥 NOVO: Valor independente para gerente
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
    // Valores padrão para consultores
    consultant_value_per_arcada: 750,
    consultant_bonus_every_arcadas: 7,
    consultant_bonus_value: 750,
    // Valores padrão para gerentes - ATUALIZADO
    manager_value_per_arcada: 750, // 🔥 NOVO: Valor independente, inicialmente igual ao consultor
    manager_bonus_active: true,
    manager_bonus_35_arcadas: 5000,
    manager_bonus_50_arcadas: 10000,
    manager_bonus_75_arcadas: 15000,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previewArcadas, setPreviewArcadas] = useState(10)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && establishmentCode) {
      fetchExistingSettings()
    }
  }, [isOpen, establishmentCode])

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
          manager_bonus_active: data.manager_bonus_active !== false,
          // 🔥 NOVO: Garantir que o campo manager_value_per_arcada existe
          manager_value_per_arcada: data.manager_value_per_arcada || data.consultant_value_per_arcada || 750,
        })
      } else {
        // Usar valores padrão se não existir configuração
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

      // Validações
      if (settings.consultant_value_per_arcada <= 0) {
        toast.error('Valor por arcada do consultor deve ser maior que zero')
        return
      }

      if (settings.manager_value_per_arcada <= 0) {
        toast.error('Valor por arcada do gerente deve ser maior que zero')
        return
      }

      if (settings.consultant_bonus_every_arcadas <= 0) {
        toast.error('Intervalo de bônus do consultor deve ser maior que zero')
        return
      }

      if (settings.consultant_bonus_value <= 0) {
        toast.error('Valor do bônus do consultor deve ser maior que zero')
        return
      }

      const dataToSave = {
        establishment_code: establishmentCode,
        consultant_value_per_arcada: settings.consultant_value_per_arcada,
        consultant_bonus_every_arcadas: settings.consultant_bonus_every_arcadas,
        consultant_bonus_value: settings.consultant_bonus_value,
        manager_value_per_arcada: settings.manager_value_per_arcada, // 🔥 NOVO: Salvar valor independente
        manager_bonus_active: settings.manager_bonus_active,
        manager_bonus_35_arcadas: settings.manager_bonus_active ? settings.manager_bonus_35_arcadas : 0,
        manager_bonus_50_arcadas: settings.manager_bonus_active ? settings.manager_bonus_50_arcadas : 0,
        manager_bonus_75_arcadas: settings.manager_bonus_active ? settings.manager_bonus_75_arcadas : 0,
      }

      if (settings.id) {
        // Atualizar existente
        const { error } = await supabase
          .from('establishment_commissions')
          .update({
            ...dataToSave,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id)

        if (error) throw error
      } else {
        // Inserir novo
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

  const calculateConsultantPreview = () => {
    const valorBase = previewArcadas * settings.consultant_value_per_arcada
    const bonusGanhos = Math.floor(previewArcadas / settings.consultant_bonus_every_arcadas)
    const valorBonus = bonusGanhos * settings.consultant_bonus_value
    return {
      valorBase,
      bonusGanhos,
      valorBonus,
      valorTotal: valorBase + valorBonus
    }
  }

  const calculateManagerPreview = () => {
    // 🔥 ATUALIZADO: Usar valor independente do gerente
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
                        {/* Configurações do Consultor */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-blue-900 mb-4 flex items-center">
                            <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                            Comissões do Consultor
                          </h4>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-blue-800 mb-2">
                                Valor por Arcada (R$)
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
                                Valor fixo pago por cada arcada vendida
                              </p>
                            </div>

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
                                A cada quantas arcadas o consultor ganha bônus
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
                        </div>

                        {/* Configurações do Gerente - ATUALIZADO */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-medium text-green-900 flex items-center">
                              <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                              Comissões do Gerente
                            </h4>
                            
                            {/* Toggle para ativar/desativar bônus */}
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
                            {/* 🔥 NOVO: Campo para valor por arcada do gerente */}
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

                            {/* Campos de bônus - só mostrar se ativo */}
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
                                  <p className="text-xs text-green-600 mt-1">
                                    Bônus adicional quando equipe atinge 35 arcadas
                                  </p>
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

                          {/* Preview Consultor */}
                          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 className="font-medium text-blue-900 mb-3">Ganhos do Consultor</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-blue-700">Valor base ({previewArcadas} arcadas):</span>
                                <span className="font-medium">R$ {consultantPreview.valorBase.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-700">Bônus ({consultantPreview.bonusGanhos}x):</span>
                                <span className="font-medium">R$ {consultantPreview.valorBonus.toLocaleString('pt-BR')}</span>
                              </div>
                              <hr className="border-blue-300" />
                              <div className="flex justify-between text-lg font-bold text-blue-900">
                                <span>Total Consultor:</span>
                                <span>R$ {consultantPreview.valorTotal.toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Preview Gerente - ATUALIZADO */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 className="font-medium text-green-900 mb-3">
                              Ganhos do Gerente {!settings.manager_bonus_active && '(Só Base)'}
                            </h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-green-700">Comissão base ({previewArcadas} arcadas):</span>
                                <span className="font-medium">R$ {managerPreview.comissaoBase.toLocaleString('pt-BR')}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-green-600">@ R$ {settings.manager_value_per_arcada}/arcada</span>
                                <span className="text-green-600">
                                  {settings.manager_value_per_arcada === settings.consultant_value_per_arcada ? 
                                    '(mesmo valor que consultor)' : 
                                    '(valor diferente do consultor)'
                                  }
                                </span>
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

                          {/* Total Geral */}
                          <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
                            <div className="flex justify-between text-lg font-bold text-primary-900">
                              <span>Custo Total ({previewArcadas} arcadas):</span>
                              <span>R$ {(consultantPreview.valorTotal + managerPreview.valorTotal).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Marcos de Referência - ATUALIZADO */}
                        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                          <h5 className="font-medium text-warning-900 mb-3">Marcos Importantes</h5>
                          <div className="space-y-2 text-sm text-warning-700">
                            <div>• Consultor: R$ {settings.consultant_value_per_arcada}/arcada + bônus a cada {settings.consultant_bonus_every_arcadas} arcadas</div>
                            <div>• Gerente: R$ {settings.manager_value_per_arcada}/arcada da equipe 
                              {settings.manager_bonus_active ? 
                                ' + marcos em 35, 50 e 75 arcadas' : 
                                ' (sem bônus)'
                              }
                            </div>
                            {settings.manager_bonus_active && (
                              <div>• Próximo marco gerente: {
                                previewArcadas < 35 ? `${35 - previewArcadas} arcadas para 1º bônus` :
                                  previewArcadas < 50 ? `${50 - previewArcadas} arcadas para 2º bônus` :
                                    previewArcadas < 75 ? `${75 - previewArcadas} arcadas para 3º bônus` :
                                      'Todos os marcos atingidos!'
                              }</div>
                            )}
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