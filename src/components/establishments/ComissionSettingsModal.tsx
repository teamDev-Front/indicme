// src/components/establishments/CommissionSettingsModal.tsx
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
  // Configurações do Gerente
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
    // Valores padrão para gerentes
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
        manager_bonus_35_arcadas: settings.manager_bonus_35_arcadas,
        manager_bonus_50_arcadas: settings.manager_bonus_50_arcadas,
        manager_bonus_75_arcadas: settings.manager_bonus_75_arcadas,
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
    const bonus35 = Math.floor(previewArcadas / 35)
    const bonus50 = Math.floor(previewArcadas / 50)
    const bonus75 = Math.floor(previewArcadas / 75)

    const valor35 = bonus35 * (settings.consultant_value_per_arcada + settings.manager_bonus_35_arcadas)
    const valor50 = bonus50 * (settings.consultant_value_per_arcada + settings.manager_bonus_50_arcadas)
    const valor75 = bonus75 * (settings.consultant_value_per_arcada + settings.manager_bonus_75_arcadas)

    return {
      bonus35,
      bonus50,
      bonus75,
      valor35,
      valor50,
      valor75,
      valorTotal: valor35 + valor50 + valor75
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

                        {/* Configurações do Gerente */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-green-900 mb-4 flex items-center">
                            <CurrencyDollarIcon className="h-5 w-5 mr-2" />
                            Comissões do Gerente
                          </h4>

                          <div className="space-y-4">
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
                                Valor pago ao gerente + valor da arcada
                              </p>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-green-800 mb-2">
                                Bônus a cada 50 arcadas (R$)
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
                                Bônus a cada 75 arcadas (R$)
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

                          <div className="mt-4 bg-green-100 border border-green-300 rounded-lg p-3">
                            <div className="flex">
                              <InformationCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                              <div>
                                <h4 className="text-sm font-medium text-green-900">Como funciona:</h4>
                                <ul className="text-sm text-green-700 mt-1 space-y-1">
                                  <li>• Gerente ganha baseado nas arcadas convertidas de TODA sua equipe</li>
                                  <li>• A cada 35 arcadas: R$ {settings.consultant_value_per_arcada} + R$ {settings.manager_bonus_35_arcadas}</li>
                                  <li>• A cada 50 arcadas: R$ {settings.consultant_value_per_arcada} + R$ {settings.manager_bonus_50_arcadas}</li>
                                  <li>• A cada 75 arcadas: R$ {settings.consultant_value_per_arcada} + R$ {settings.manager_bonus_75_arcadas}</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Preview Calculator */}
                      <div className="space-y-6">
                        <div className="bg-secondary-50 border border-secondary-200 rounded-lg p-4">
                          <h4 className="text-lg font-medium text-secondary-900 mb-4 flex items-center">
                            <CalculatorIcon className="h-5 w-5 mr-2" />
                            Simulador de Ganhos
                          </h4>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-secondary-700 mb-2">
                              Arcadas para simulação
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

                          {/* Preview Gerente */}
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 className="font-medium text-green-900 mb-3">Ganhos do Gerente</h5>
                            <div className="space-y-2 text-sm">
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
                              {managerPreview.valorTotal > 0 && (
                                <>
                                  <hr className="border-green-300" />
                                  <div className="flex justify-between text-lg font-bold text-green-900">
                                    <span>Total Gerente:</span>
                                    <span>R$ {managerPreview.valorTotal.toLocaleString('pt-BR')}</span>
                                  </div>
                                </>
                              )}
                              {managerPreview.valorTotal === 0 && (
                                <div className="text-center text-green-600 italic">
                                  Gerente ainda não atingiu marcos de bônus
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Total Geral */}
                          <div className="mt-4 bg-primary-50 border border-primary-200 rounded-lg p-4">
                            <div className="flex justify-between text-lg font-bold text-primary-900">
                              <span>Total Geral ({previewArcadas} arcadas):</span>
                              <span>R$ {(consultantPreview.valorTotal + managerPreview.valorTotal).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        </div>

                        {/* Marcos de Referência */}
                        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                          <h5 className="font-medium text-warning-900 mb-3">Marcos Importantes</h5>
                          <div className="space-y-2 text-sm text-warning-700">
                            <div>• Consultor: bônus a cada {settings.consultant_bonus_every_arcadas} arcadas</div>
                            <div>• Gerente: marcos em 35, 50 e 75 arcadas da equipe</div>
                            <div>• Próximo marco gerente: {
                              previewArcadas < 35 ? `${35 - previewArcadas} arcadas para 1º bônus` :
                              previewArcadas < 50 ? `${50 - previewArcadas} arcadas para 2º bônus` :
                              previewArcadas < 75 ? `${75 - previewArcadas} arcadas para 3º bônus` :
                              'Todos os marcos atingidos!'
                            }</div>
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