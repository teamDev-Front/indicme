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
  consultant_percentage: number
  manager_percentage: number
  base_commission_value: number
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
    consultant_percentage: 10.00,
    manager_percentage: 5.00,
    base_commission_value: 100.00,
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
  const [previewValue, setPreviewValue] = useState(1000)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.role === 'clinic_admin') {
      fetchSettings()
    }
  }, [profile])

  useEffect(() => {
    setHasChanges(true)
  }, [commissionSettings.consultant_percentage, commissionSettings.manager_percentage, commissionSettings.base_commission_value])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      
      // Buscar clínica do usuário
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      // Buscar configurações de comissão
      const { data: commissionData, error: commissionError } = await supabase
        .from('commission_settings')
        .select('*')
        .eq('clinic_id', userClinic.clinic_id)
        .single()

      if (commissionError && commissionError.code !== 'PGRST116') {
        throw commissionError
      }

      if (commissionData) {
        setCommissionSettings(commissionData)
      } else {
        setCommissionSettings(prev => ({ ...prev, clinic_id: userClinic.clinic_id }))
      }

      // Buscar dados da clínica
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', userClinic.clinic_id)
        .single()

      if (clinicError) throw clinicError
      if (clinicData) setClinicSettings(clinicData)

      setHasChanges(false)
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error)
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCommissions = async () => {
    try {
      setSaving(true)

      if (commissionSettings.id) {
        const { error } = await supabase
          .from('commission_settings')
          .update({
            consultant_percentage: commissionSettings.consultant_percentage,
            manager_percentage: commissionSettings.manager_percentage,
            base_commission_value: commissionSettings.base_commission_value,
            updated_at: new Date().toISOString()
          })
          .eq('id', commissionSettings.id)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('commission_settings')
          .insert({
            clinic_id: commissionSettings.clinic_id,
            consultant_percentage: commissionSettings.consultant_percentage,
            manager_percentage: commissionSettings.manager_percentage,
            base_commission_value: commissionSettings.base_commission_value,
          })
          .select()
          .single()

        if (error) throw error
        setCommissionSettings(data)
      }

      setHasChanges(false)
      toast.success('Configurações de comissão salvas com sucesso!')
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
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

  const calculatePreview = () => {
    const consultantCommission = (previewValue * commissionSettings.consultant_percentage) / 100
    const managerCommission = (previewValue * commissionSettings.manager_percentage) / 100
    
    return {
      leadValue: previewValue,
      consultantCommission,
      managerCommission,
      totalCommission: consultantCommission + managerCommission
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
                <h3 className="text-sm font-medium text-warning-800">Importante</h3>
                <p className="text-sm text-warning-700 mt-1">
                  As alterações nas configurações de comissões afetarão apenas os novos leads criados após a modificação.
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
                    Percentual do Consultor
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="input pr-8"
                      value={commissionSettings.consultant_percentage}
                      onChange={(e) => setCommissionSettings(prev => ({ 
                        ...prev, 
                        consultant_percentage: parseFloat(e.target.value) || 0 
                      }))}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-secondary-500 text-sm">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Percentual do Manager
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="input pr-8"
                      value={commissionSettings.manager_percentage}
                      onChange={(e) => setCommissionSettings(prev => ({ 
                        ...prev, 
                        manager_percentage: parseFloat(e.target.value) || 0 
                      }))}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-secondary-500 text-sm">%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Valor Base da Comissão
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
                      value={commissionSettings.base_commission_value}
                      onChange={(e) => setCommissionSettings(prev => ({ 
                        ...prev, 
                        base_commission_value: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
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
                  Simulador de Comissões
                </h3>
              </div>
              <div className="card-body space-y-6">
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Valor do Serviço para Simulação
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
                      value={previewValue}
                      onChange={(e) => setPreviewValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-primary-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-primary-900 mb-2">Comissão do Consultor</h4>
                    <div className="text-2xl font-bold text-primary-600">
                      R$ {preview.consultantCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-success-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-success-900 mb-2">Comissão do Gerente</h4>
                    <div className="text-2xl font-bold text-success-600">
                      R$ {preview.managerCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-secondary-100 rounded-lg p-4 border-2 border-secondary-300">
                    <h4 className="text-sm font-medium text-secondary-900 mb-2">Total de Comissões</h4>
                    <div className="text-2xl font-bold text-secondary-900">
                      R$ {preview.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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