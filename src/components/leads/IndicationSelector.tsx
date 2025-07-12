// src/components/leads/IndicationSelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, UserIcon, CurrencyDollarIcon, CheckIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/utils/supabase/client'

interface Consultant {
  id: string
  full_name: string
  email: string
  establishment_name?: string
  establishment_code?: string
}

interface ConvertedLead {
  id: string
  full_name: string
  phone: string
  indicated_by: string
  consultant_name: string
  consultant_email: string
  establishment_code?: string
}

interface CommissionPreview {
  baseValue: number
  percentage: number
  finalValue: number
  establishment: string
}

interface IndicationSelectorProps {
  selectedType: 'consultant' | 'lead'
  selectedId: string | null
  commissionPercentage: number
  onTypeChange: (type: 'consultant' | 'lead') => void
  onSelectionChange: (id: string, type: 'consultant' | 'lead') => void
  onPercentageChange: (percentage: number) => void
  clinicId: string
}

export default function IndicationSelector({
  selectedType,
  selectedId,
  commissionPercentage,
  onTypeChange,
  onSelectionChange,
  onPercentageChange,
  clinicId
}: IndicationSelectorProps) {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [convertedLeads, setConvertedLeads] = useState<ConvertedLead[]>([])
  const [searchConsultants, setSearchConsultants] = useState('')
  const [searchLeads, setSearchLeads] = useState('')
  const [commissionPreview, setCommissionPreview] = useState<CommissionPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (clinicId) {
      fetchData()
    }
  }, [clinicId])

  useEffect(() => {
    updateCommissionPreview()
  }, [selectedId, selectedType, commissionPercentage, consultants, convertedLeads])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchConsultants(),
        fetchConvertedLeads()
      ])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }


const fetchConsultants = async () => {
  try {
    console.log('🔍 Buscando consultores para clínica:', clinicId)
    
    // CORREÇÃO: Query simplificada e corrigida
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        user_clinics!inner(clinic_id)
      `)
      .eq('user_clinics.clinic_id', clinicId)
      .eq('role', 'consultant')
      .eq('status', 'active')
      .order('full_name')

    if (error) {
      console.error('❌ Erro ao buscar consultores:', error)
      return
    }

    console.log('✅ Consultores encontrados (dados brutos):', data?.length || 0)

    if (!data || data.length === 0) {
      console.log('⚠️ Nenhum consultor encontrado para a clínica')
      setConsultants([])
      return
    }

    // Para cada consultor, buscar seu estabelecimento separadamente
    const consultantsWithEstablishments = await Promise.all(
      data.map(async (consultant) => {
        try {
          // Buscar estabelecimento do consultor
          const { data: userEst, error: estError } = await supabase
            .from('user_establishments')
            .select(`
              establishment_code,
              establishment_codes!user_establishments_establishment_code_fkey (
                code,
                name
              )
            `)
            .eq('user_id', consultant.id)
            .eq('status', 'active')
            .maybeSingle() // Pode não ter estabelecimento

          if (estError) {
            console.warn(`⚠️ Erro ao buscar estabelecimento para ${consultant.full_name}:`, estError)
          }

          let establishmentName = 'Sem estabelecimento'
          let establishmentCode = ''

          if (userEst?.establishment_codes) {
            // CORREÇÃO: Tratar o tipo corretamente
            const estData = userEst.establishment_codes as any
            establishmentName = estData.name || `Código: ${userEst.establishment_code}`
            establishmentCode = estData.code || userEst.establishment_code
          }

          return {
            id: consultant.id,
            full_name: consultant.full_name,
            email: consultant.email,
            establishment_name: establishmentName,
            establishment_code: establishmentCode
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao processar consultor ${consultant.full_name}:`, error)
          return {
            id: consultant.id,
            full_name: consultant.full_name,
            email: consultant.email,
            establishment_name: 'Erro ao carregar',
            establishment_code: ''
          }
        }
      })
    )

    console.log('✅ Consultores processados:', consultantsWithEstablishments.length)
    console.log('📋 Exemplo de consultor:', consultantsWithEstablishments[0])

    setConsultants(consultantsWithEstablishments)
  } catch (error) {
    console.error('❌ Erro geral ao buscar consultores:', error)
    setConsultants([])
  }
}

  const fetchConvertedLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          full_name,
          phone,
          indicated_by,
          establishment_code,
          users!leads_indicated_by_fkey (
            full_name,
            email
          )
        `)
        .eq('clinic_id', clinicId)
        .eq('status', 'converted')
        .order('created_at', { ascending: false })
        .limit(50) // Limitar para performance

      if (error) throw error

      const leadsData = data?.map((lead: any) => ({
        id: lead.id,
        full_name: lead.full_name,
        phone: lead.phone,
        indicated_by: lead.indicated_by,
        consultant_name: (lead.users as any)?.full_name || 'Consultor não encontrado',
        consultant_email: (lead.users as any)?.email || '',
        establishment_code: lead.establishment_code
      })) || []

      setConvertedLeads(leadsData)
    } catch (error) {
      console.error('Erro ao buscar leads convertidos:', error)
    }
  }

  const updateCommissionPreview = async () => {
    if (!selectedId) {
      setCommissionPreview(null)
      return
    }

    try {
      let establishmentCode = ''
      let establishmentName = ''

      if (selectedType === 'consultant') {
        const consultant = consultants.find(c => c.id === selectedId)
        establishmentCode = consultant?.establishment_code || ''
        establishmentName = consultant?.establishment_name || ''
      } else {
        const lead = convertedLeads.find(l => l.id === selectedId)
        establishmentCode = lead?.establishment_code || ''
        
        // Buscar nome do estabelecimento
        if (establishmentCode) {
          const { data } = await supabase
            .from('establishment_codes')
            .select('name')
            .eq('code', establishmentCode)
            .single()
          
          establishmentName = data?.name || establishmentCode
        }
      }

      if (!establishmentCode) {
        setCommissionPreview(null)
        return
      }

      // Buscar configuração de comissão do estabelecimento
      const { data: settings } = await supabase
        .from('establishment_commissions')
        .select('consultant_value_per_arcada')
        .eq('establishment_code', establishmentCode)
        .single()

      const baseValue = settings?.consultant_value_per_arcada || 750
      const percentage = commissionPercentage || 100
      const finalValue = (baseValue * percentage) / 100

      setCommissionPreview({
        baseValue,
        percentage,
        finalValue,
        establishment: establishmentName
      })
    } catch (error) {
      console.error('Erro ao calcular preview:', error)
      setCommissionPreview(null)
    }
  }

  const filteredConsultants = consultants.filter(consultant =>
    consultant.full_name.toLowerCase().includes(searchConsultants.toLowerCase()) ||
    consultant.email.toLowerCase().includes(searchConsultants.toLowerCase()) ||
    (consultant.establishment_name && consultant.establishment_name.toLowerCase().includes(searchConsultants.toLowerCase()))
  )

  const filteredLeads = convertedLeads.filter(lead =>
    lead.full_name.toLowerCase().includes(searchLeads.toLowerCase()) ||
    lead.phone.includes(searchLeads) ||
    lead.consultant_name.toLowerCase().includes(searchLeads.toLowerCase())
  )

  const handleTypeChange = (type: 'consultant' | 'lead') => {
    onTypeChange(type)
    if (type === 'lead') {
      onPercentageChange(50) // Padrão 50% para leads
    } else {
      onPercentageChange(100) // Padrão 100% para consultores
    }
  }

  return (
    <div className="space-y-6">
      {/* Seletor de Tipo */}
      <div>
        <h4 className="text-sm font-medium text-secondary-700 mb-3">Tipo de Indicação</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleTypeChange('consultant')}
            className={`relative p-6 border-2 rounded-xl transition-all duration-200 ${
              selectedType === 'consultant'
                ? 'border-primary-500 bg-primary-50 shadow-lg'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                selectedType === 'consultant' ? 'bg-primary-100' : 'bg-gray-100'
              }`}>
                <UserIcon className={`h-6 w-6 ${
                  selectedType === 'consultant' ? 'text-primary-600' : 'text-gray-500'
                }`} />
              </div>
              <h5 className="font-medium text-gray-900 mb-1">Consultor Direto</h5>
              <p className="text-sm text-gray-500 mb-2">Indicação direta de um consultor</p>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                selectedType === 'consultant' 
                  ? 'bg-primary-100 text-primary-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                100% da comissão
              </div>
            </div>
            {selectedType === 'consultant' && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTypeChange('lead')}
            className={`relative p-6 border-2 rounded-xl transition-all duration-200 ${
              selectedType === 'lead'
                ? 'border-success-500 bg-success-50 shadow-lg'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                selectedType === 'lead' ? 'bg-success-100' : 'bg-gray-100'
              }`}>
                <CurrencyDollarIcon className={`h-6 w-6 ${
                  selectedType === 'lead' ? 'text-success-600' : 'text-gray-500'
                }`} />
              </div>
              <h5 className="font-medium text-gray-900 mb-1">Lead Convertido</h5>
              <p className="text-sm text-gray-500 mb-2">Indicação de um cliente</p>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                selectedType === 'lead' 
                  ? 'bg-success-100 text-success-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                % editável da comissão
              </div>
            </div>
            {selectedType === 'lead' && (
              <div className="absolute top-3 right-3">
                <div className="w-6 h-6 bg-success-600 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Seleção de Consultor */}
      {selectedType === 'consultant' && (
        <div>
          <h4 className="text-sm font-medium text-secondary-700 mb-3">Selecionar Consultor</h4>
          
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou estabelecimento..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchConsultants}
              onChange={(e) => setSearchConsultants(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
            {loading ? (
              <div className="p-8 text-center">
                <div className="loading-spinner w-6 h-6 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Carregando consultores...</p>
              </div>
            ) : filteredConsultants.length > 0 ? (
              filteredConsultants.map((consultant) => (
                <div
                  key={consultant.id}
                  onClick={() => onSelectionChange(consultant.id, 'consultant')}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedId === consultant.id 
                      ? 'bg-primary-50 border-primary-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-700">
                          {consultant.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{consultant.full_name}</div>
                        <div className="text-sm text-gray-500">{consultant.email}</div>
                        {consultant.establishment_name && (
                          <div className="text-xs text-primary-600 font-medium">
                            📍 {consultant.establishment_name}
                          </div>
                        )}
                      </div>
                    </div>
                    {selectedId === consultant.id && (
                      <div className="w-6 h-6 bg-success-600 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum consultor encontrado</p>
                {searchConsultants && (
                  <p className="text-sm mt-1">Tente ajustar o termo de busca</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seleção de Lead */}
      {selectedType === 'lead' && (
        <div>
          <h4 className="text-sm font-medium text-secondary-700 mb-3">Selecionar Lead Convertido</h4>
          
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou consultor responsável..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-success-500"
              value={searchLeads}
              onChange={(e) => setSearchLeads(e.target.value)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
            {loading ? (
              <div className="p-8 text-center">
                <div className="loading-spinner w-6 h-6 mx-auto mb-2"></div>
                <p className="text-sm text-gray-500">Carregando leads...</p>
              </div>
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => onSelectionChange(lead.id, 'lead')}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedId === lead.id 
                      ? 'bg-success-50 border-success-200' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-success-700">
                          {lead.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{lead.full_name}</div>
                        <div className="text-sm text-gray-500">{lead.phone}</div>
                        <div className="text-xs text-success-600 font-medium">
                          👤 Convertido por: {lead.consultant_name}
                        </div>
                      </div>
                    </div>
                    {selectedId === lead.id && (
                      <div className="w-6 h-6 bg-success-600 rounded-full flex items-center justify-center">
                        <CheckIcon className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <CurrencyDollarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum lead convertido encontrado</p>
                {searchLeads && (
                  <p className="text-sm mt-1">Tente ajustar o termo de busca</p>
                )}
              </div>
            )}
          </div>

          {/* Controle de Percentual */}
          {selectedId && (
            <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
              <h5 className="text-sm font-medium text-success-900 mb-3">Percentual da Comissão</h5>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={commissionPercentage}
                    onChange={(e) => onPercentageChange(Number(e.target.value))}
                    className="w-full h-2 bg-success-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-success-600 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={commissionPercentage}
                    onChange={(e) => onPercentageChange(Number(e.target.value))}
                    className="w-full px-3 py-2 text-center border border-success-300 rounded-lg focus:ring-2 focus:ring-success-500 focus:border-success-500"
                  />
                </div>
                <span className="text-sm font-medium text-success-700">%</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preview da Comissão */}
      {commissionPreview && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <CurrencyDollarIcon className="h-5 w-5 mr-2" />
            Preview da Comissão
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-sm text-blue-600 mb-1">Estabelecimento</div>
              <div className="font-medium text-blue-900 text-sm">
                {commissionPreview.establishment}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 mb-1">Valor Base</div>
              <div className="text-lg font-semibold text-blue-900">
                R$ {commissionPreview.baseValue.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 mb-1">Percentual</div>
              <div className="text-lg font-semibold text-blue-900">
                {commissionPreview.percentage}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-blue-600 mb-1">Valor Final</div>
              <div className="text-xl font-bold text-indigo-600">
                R$ {commissionPreview.finalValue.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              💡 <strong>Como funciona:</strong> O consultor receberá{' '}
              <span className="font-semibold">R$ {commissionPreview.finalValue.toFixed(2)}</span>{' '}
              ({commissionPreview.percentage}% de R$ {commissionPreview.baseValue.toFixed(2)}) quando este lead for convertido.
            </p>
          </div>
        </div>
      )}

      {/* CSS para o slider */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  )
}