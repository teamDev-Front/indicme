'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { ArrowLeftIcon, MagnifyingGlassIcon, UserIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

const leadSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
  indicated_by_type: z.enum(['consultant', 'lead']),
  indicated_by_id: z.string().min(1, 'Selecione quem indicou'),
  commission_percentage: z.number().min(0).max(100).optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

interface Consultant {
  id: string
  full_name: string
  email: string
  establishment_name?: string
}

interface ConvertedLead {
  id: string
  full_name: string
  phone: string
  indicated_by: string
  consultant_name: string
  consultant_email: string
}

interface EstablishmentCommission {
  establishment_code: string
  consultant_value_per_arcada: number
}

export default function NewLeadPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [convertedLeads, setConvertedLeads] = useState<ConvertedLead[]>([])
  const [searchConsultants, setSearchConsultants] = useState('')
  const [searchLeads, setSearchLeads] = useState('')
  const [establishments, setEstablishments] = useState<EstablishmentCommission[]>([])
  const [selectedEstablishment, setSelectedEstablishment] = useState<string>('')
  const [commissionPreview, setCommissionPreview] = useState<{
    baseValue: number
    percentage: number
    finalValue: number
  } | null>(null)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      indicated_by_type: 'consultant',
      commission_percentage: 100,
    }
  })

  const indicatedByType = watch('indicated_by_type')
  const indicatedById = watch('indicated_by_id')
  const commissionPercentage = watch('commission_percentage')

  useEffect(() => {
    if (profile?.role === 'clinic_admin') {
      fetchConsultants()
      fetchConvertedLeads()
      fetchEstablishments()
    }
  }, [profile])

  useEffect(() => {
    if (indicatedByType === 'lead') {
      setValue('commission_percentage', 50)
    } else {
      setValue('commission_percentage', 100)
    }
  }, [indicatedByType, setValue])

  useEffect(() => {
    updateCommissionPreview()
  }, [indicatedById, commissionPercentage, selectedEstablishment, establishments, consultants, convertedLeads])

  const fetchConsultants = async () => {
    try {
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          user_clinics!inner(clinic_id),
          user_establishments (
            establishment_code,
            establishment_codes (name)
          )
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('role', 'consultant')
        .eq('status', 'active')

      if (error) throw error

      const consultantsData = data?.map((consultant: any) => ({
        id: consultant.id,
        full_name: consultant.full_name,
        email: consultant.email,
        establishment_name: (consultant.user_establishments?.[0]?.establishment_codes as any)?.name || 'Sem estabelecimento'
      })) || []

      setConsultants(consultantsData)
    } catch (error: any) {
      console.error('Erro ao buscar consultores:', error)
    }
  }

  const fetchConvertedLeads = async () => {
    try {
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) return

      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          full_name,
          phone,
          indicated_by,
          users!leads_indicated_by_fkey (
            full_name,
            email
          )
        `)
        .eq('clinic_id', userClinic.clinic_id)
        .eq('status', 'converted')
        .order('created_at', { ascending: false })

      if (error) throw error

      const leadsData = data?.map((lead: any) => ({
        id: lead.id,
        full_name: lead.full_name,
        phone: lead.phone,
        indicated_by: lead.indicated_by,
        consultant_name: (lead.users as any)?.full_name || 'Consultor não encontrado',
        consultant_email: (lead.users as any)?.email || ''
      })) || []

      setConvertedLeads(leadsData)
    } catch (error: any) {
      console.error('Erro ao buscar leads convertidos:', error)
    }
  }

  const fetchEstablishments = async () => {
    try {
      const { data, error } = await supabase
        .from('establishment_commissions')
        .select('establishment_code, consultant_value_per_arcada')

      if (error) throw error

      setEstablishments(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar estabelecimentos:', error)
    }
  }

  const updateCommissionPreview = () => {
    if (!indicatedById) {
      setCommissionPreview(null)
      return
    }

    let establishment: EstablishmentCommission | undefined

    if (indicatedByType === 'consultant') {
      // Buscar estabelecimento do consultor
      const consultant = consultants.find(c => c.id === indicatedById)
      if (consultant?.establishment_name && consultant.establishment_name !== 'Sem estabelecimento') {
        establishment = establishments.find(e => 
          e.establishment_code === consultant.establishment_name || 
          selectedEstablishment === e.establishment_code
        )
      }
    } else if (indicatedByType === 'lead') {
      // Buscar estabelecimento do consultor que converteu o lead original
      const lead = convertedLeads.find(l => l.id === indicatedById)
      if (lead) {
        const originalConsultant = consultants.find(c => c.id === lead.indicated_by)
        if (originalConsultant?.establishment_name && originalConsultant.establishment_name !== 'Sem estabelecimento') {
          establishment = establishments.find(e => 
            e.establishment_code === originalConsultant.establishment_name ||
            selectedEstablishment === e.establishment_code
          )
        }
      }
    }

    if (!establishment || !selectedEstablishment) {
      setCommissionPreview(null)
      return
    }

    const baseValue = establishment.consultant_value_per_arcada
    const percentage = commissionPercentage || 100
    const finalValue = (baseValue * percentage) / 100

    setCommissionPreview({
      baseValue,
      percentage,
      finalValue
    })
  }

  const filteredConsultants = consultants.filter(consultant =>
    consultant.full_name.toLowerCase().includes(searchConsultants.toLowerCase()) ||
    consultant.email.toLowerCase().includes(searchConsultants.toLowerCase())
  )

  const filteredLeads = convertedLeads.filter(lead =>
    lead.full_name.toLowerCase().includes(searchLeads.toLowerCase()) ||
    lead.phone.includes(searchLeads) ||
    lead.consultant_name.toLowerCase().includes(searchLeads.toLowerCase())
  )

  const onSubmit = async (data: LeadFormData) => {
    if (!profile) return

    try {
      setIsSubmitting(true)

      // Buscar a clínica do usuário
      const { data: userClinic, error: clinicError } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile.id)
        .single()

      if (clinicError || !userClinic) {
        throw new Error('Usuário não está associado a uma clínica')
      }

      // Determinar quem realmente indicou
      let actualIndicatedBy = data.indicated_by_id
      let originalLeadId: string | null = null

      if (data.indicated_by_type === 'lead') {
        // Se foi indicado por um lead, pegar o consultor desse lead
        const selectedLead = convertedLeads.find(lead => lead.id === data.indicated_by_id)
        if (selectedLead) {
          actualIndicatedBy = selectedLead.indicated_by
          originalLeadId = selectedLead.id
        }
      }

      // Preparar dados do lead
      const leadData = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes || null,
        indicated_by: actualIndicatedBy,
        clinic_id: userClinic.clinic_id,
        status: 'new' as const,
        // Campos adicionais para tracking
        original_lead_id: originalLeadId,
        indication_type: data.indicated_by_type,
        commission_percentage: data.commission_percentage || 100,
      }

      const { data: newLead, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single()

      if (error) {
        throw error
      }

      // Se foi indicado por outro lead, criar registro de indicação
      if (data.indicated_by_type === 'lead' && originalLeadId) {
        await supabase
          .from('lead_indications')
          .insert({
            original_lead_id: originalLeadId,
            new_lead_id: newLead.id,
            commission_percentage: data.commission_percentage || 50,
            created_by: profile.id
          })
      }

      toast.success('Lead cadastrado com sucesso!')
      reset()
      router.push('/dashboard/leads')
    } catch (error: any) {
      console.error('Erro ao cadastrar lead:', error)
      toast.error(error.message || 'Erro ao cadastrar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verificar se é admin
  if (profile?.role !== 'clinic_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-secondary-900 mb-2">Acesso Restrito</h3>
          <p className="text-secondary-500">
            Apenas administradores podem usar este formulário avançado.
          </p>
          <Link href="/dashboard/leads/new" className="btn btn-primary mt-4">
            Usar Formulário Simples
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/leads"
            className="btn btn-ghost btn-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Voltar
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              Novo Lead (Admin)
            </h1>
            <p className="text-secondary-600">
              Cadastre uma nova indicação com controle de comissão
            </p>
          </div>
        </div>
      </div>

      {/* Seleção de Estabelecimento */}
      {establishments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card"
        >
          <div className="card-body">
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Selecionar Estabelecimento
            </h3>
            <select
              value={selectedEstablishment}
              onChange={(e) => setSelectedEstablishment(e.target.value)}
              className="select w-full max-w-xs"
            >
              <option value="">Selecione um estabelecimento</option>
              {establishments.map((establishment) => (
                <option key={establishment.establishment_code} value={establishment.establishment_code}>
                  {establishment.establishment_code} - R$ {establishment.consultant_value_per_arcada.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card max-w-4xl mx-auto"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="card-body space-y-8">
          {/* Dados do Lead */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Dados do Lead
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium text-secondary-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  id="full_name"
                  {...register('full_name')}
                  className={`input ${errors.full_name ? 'input-error' : ''}`}
                  placeholder="Nome completo do lead"
                />
                {errors.full_name && (
                  <p className="mt-1 text-sm text-danger-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  id="phone"
                  {...register('phone')}
                  className={`input ${errors.phone ? 'input-error' : ''}`}
                  placeholder="(11) 99999-9999"
                />
                {errors.phone && (
                  <p className="mt-1 text-sm text-danger-600">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  id="email"
                  {...register('email')}
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="email@exemplo.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-danger-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-secondary-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  id="notes"
                  {...register('notes')}
                  rows={3}
                  className="input"
                  placeholder="Informações adicionais sobre o lead..."
                />
              </div>
            </div>
          </div>

          {/* Quem Indicou */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Quem Indicou Este Lead?
            </h3>

            {/* Tipo de Indicação */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('indicated_by_type', 'consultant')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    indicatedByType === 'consultant'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <UserIcon className="h-8 w-8 mx-auto mb-2 text-primary-600" />
                  <div className="text-sm font-medium">Consultor Direto</div>
                  <div className="text-xs text-gray-500 mt-1">100% da comissão</div>
                </button>

                <button
                  type="button"
                  onClick={() => setValue('indicated_by_type', 'lead')}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    indicatedByType === 'lead'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <CurrencyDollarIcon className="h-8 w-8 mx-auto mb-2 text-success-600" />
                  <div className="text-sm font-medium">Lead Convertido</div>
                  <div className="text-xs text-gray-500 mt-1">% editável da comissão</div>
                </button>
              </div>
            </div>

            {/* Seleção de Consultor */}
            {indicatedByType === 'consultant' && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Selecionar Consultor *
                </label>
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar consultor por nome ou email..."
                    className="input pl-10"
                    value={searchConsultants}
                    onChange={(e) => setSearchConsultants(e.target.value)}
                  />
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredConsultants.map((consultant) => (
                    <div
                      key={consultant.id}
                      onClick={() => setValue('indicated_by_id', consultant.id)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        indicatedById === consultant.id ? 'bg-primary-50 border-primary-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900">{consultant.full_name}</div>
                          <div className="text-sm text-gray-500">{consultant.email}</div>
                          <div className="text-xs text-primary-600">{consultant.establishment_name}</div>
                        </div>
                        {indicatedById === consultant.id && (
                          <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredConsultants.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Nenhum consultor encontrado
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Seleção de Lead */}
            {indicatedByType === 'lead' && (
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Selecionar Lead Convertido *
                </label>
                <div className="relative mb-4">
                  <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Buscar lead por nome, telefone ou consultor..."
                    className="input pl-10"
                    value={searchLeads}
                    onChange={(e) => setSearchLeads(e.target.value)}
                  />
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => setValue('indicated_by_id', lead.id)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        indicatedById === lead.id ? 'bg-success-50 border-success-200' : ''
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-900">{lead.full_name}</div>
                          <div className="text-sm text-gray-500">{lead.phone}</div>
                          <div className="text-xs text-success-600">
                            Convertido por: {lead.consultant_name}
                          </div>
                        </div>
                        {indicatedById === lead.id && (
                          <div className="w-6 h-6 bg-success-600 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredLeads.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Nenhum lead convertido encontrado
                    </div>
                  )}
                </div>

                {/* Percentual de Comissão */}
                {indicatedById && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-secondary-700 mb-2">
                      Percentual da Comissão (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      {...register('commission_percentage', { valueAsNumber: true })}
                      className="input w-32"
                      placeholder="50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Percentual da comissão que será paga ao consultor
                    </p>
                  </div>
                )}
              </div>
            )}

            {errors.indicated_by_id && (
              <p className="mt-2 text-sm text-danger-600">{errors.indicated_by_id.message}</p>
            )}
          </div>

          {/* Preview da Comissão */}
          {commissionPreview && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-primary-900 mb-3">Preview da Comissão</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Valor Base</div>
                  <div className="font-medium">R$ {commissionPreview.baseValue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Percentual</div>
                  <div className="font-medium">{commissionPreview.percentage}%</div>
                </div>
                <div>
                  <div className="text-gray-600">Valor Final</div>
                  <div className="font-bold text-primary-700">R$ {commissionPreview.finalValue.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-secondary-200">
            <Link
              href="/dashboard/leads"
              className="btn btn-secondary"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !indicatedById}
              className="btn btn-primary"
            >
              {isSubmitting ? (
                <>
                  <div className="loading-spinner w-4 h-4 mr-2"></div>
                  Salvando...
                </>
              ) : (
                'Cadastrar Lead'
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}