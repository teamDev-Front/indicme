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

// Schemas para validação
const basicLeadSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  notes: z.string().optional(),
})

const advancedLeadSchema = basicLeadSchema.extend({
  indicated_by_type: z.enum(['consultant', 'lead']),
  indicated_by_id: z.string().min(1, 'Selecione quem indicou'),
  commission_percentage: z.number().min(0).max(100).optional(),
})

type BasicLeadFormData = z.infer<typeof basicLeadSchema>
type AdvancedLeadFormData = z.infer<typeof advancedLeadSchema>

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
  consultant_value_per_arcada: number
  establishment_code: string
}

export default function NewLeadPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Estados para formulário avançado (admin)
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

  // Determinar qual formulário mostrar
  const isAdvancedForm = profile?.role === 'clinic_admin'

  // Formulário básico (consultant/manager)
  const basicForm = useForm<BasicLeadFormData>({
    resolver: zodResolver(basicLeadSchema),
  })

  // Formulário avançado (admin)
  const advancedForm = useForm<AdvancedLeadFormData>({
    resolver: zodResolver(advancedLeadSchema),
    defaultValues: {
      indicated_by_type: 'consultant',
      commission_percentage: 100,
    }
  })

  const indicatedByType = advancedForm.watch('indicated_by_type')
  const indicatedById = advancedForm.watch('indicated_by_id')
  const commissionPercentage = advancedForm.watch('commission_percentage')

  useEffect(() => {
    if (isAdvancedForm) {
      fetchAdvancedData()
    }
  }, [isAdvancedForm])

  useEffect(() => {
    if (indicatedByType === 'lead') {
      advancedForm.setValue('commission_percentage', 50)
    } else {
      advancedForm.setValue('commission_percentage', 100)
    }
  }, [indicatedByType, advancedForm])

  useEffect(() => {
    if (isAdvancedForm) {
      updateCommissionPreview()
    }
  }, [indicatedById, commissionPercentage, selectedEstablishment, isAdvancedForm])

  const fetchAdvancedData = async () => {
    if (!profile?.id) return

    try {
      await Promise.all([
        fetchConsultants(),
        fetchConvertedLeads(),
        fetchEstablishments()
      ])
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      toast.error('Erro ao carregar dados do formulário')
    }
  }

  const fetchConsultants = async () => {
    try {
      // CORREÇÃO 1: Query corrigida para buscar consultores
      const { data: userClinic } = await supabase
        .from('user_clinics')
        .select('clinic_id')
        .eq('user_id', profile?.id)
        .single()

      if (!userClinic) {
        console.error('Admin não está associado a uma clínica')
        return
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          user_clinics!inner(clinic_id),
          user_establishments (
            establishment_code,
            establishment_codes (
              name
            )
          )
        `)
        .eq('user_clinics.clinic_id', userClinic.clinic_id)
        .eq('role', 'consultant')
        .eq('status', 'active')
        .order('full_name')

      if (error) {
        console.error('Erro ao buscar consultores:', error)
        return
      }

      const consultantsData = data?.map(consultant => {
        // Corrigir tipos TypeScript
        const userEstablishments = consultant.user_establishments as any[]
        const establishmentCodes = userEstablishments?.[0]?.establishment_codes as any
        
        return {
          id: consultant.id,
          full_name: consultant.full_name,
          email: consultant.email,
          establishment_name: establishmentCodes?.name || 'Sem estabelecimento'
        }
      }) || []

      console.log('✅ Consultores encontrados:', consultantsData.length)
      setConsultants(consultantsData)
    } catch (error) {
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
        .limit(50)

      if (error) {
        console.error('Erro ao buscar leads convertidos:', error)
        return
      }

      const leadsData = data?.map(lead => {
        // Corrigir tipos TypeScript
        const users = lead.users as any[]
        const user = Array.isArray(users) ? users[0] : users
        
        return {
          id: lead.id,
          full_name: lead.full_name,
          phone: lead.phone,
          indicated_by: lead.indicated_by,
          consultant_name: user?.full_name || 'Consultor não encontrado',
          consultant_email: user?.email || ''
        }
      }) || []

      console.log('✅ Leads convertidos encontrados:', leadsData.length)
      setConvertedLeads(leadsData)
    } catch (error) {
      console.error('Erro ao buscar leads convertidos:', error)
    }
  }

  const fetchEstablishments = async () => {
    try {
      const { data, error } = await supabase
        .from('establishment_commissions')
        .select('establishment_code, consultant_value_per_arcada')

      if (error) {
        console.error('Erro ao buscar estabelecimentos:', error)
        return
      }

      setEstablishments(data || [])
    } catch (error) {
      console.error('Erro ao buscar estabelecimentos:', error)
    }
  }

  const updateCommissionPreview = () => {
    if (!indicatedById || !selectedEstablishment) {
      setCommissionPreview(null)
      return
    }

    const establishment = establishments.find(e => e.establishment_code === selectedEstablishment)
    if (!establishment) return

    const baseValue = establishment.consultant_value_per_arcada
    const percentage = commissionPercentage || 100
    const finalValue = (baseValue * percentage) / 100

    setCommissionPreview({
      baseValue,
      percentage,
      finalValue
    })
  }

  // Submit para formulário básico (consultant/manager)
  const onBasicSubmit = async (data: BasicLeadFormData) => {
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

      // Buscar establishment_code do usuário
      const { data: userEstablishment } = await supabase
        .from('user_establishments')
        .select('establishment_code')
        .eq('user_id', profile.id)
        .eq('status', 'active')
        .single()

      // Preparar dados do lead
      const leadData = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes || null,
        indicated_by: profile.id, // O próprio usuário indica
        clinic_id: userClinic.clinic_id,
        status: 'new' as const,
        establishment_code: userEstablishment?.establishment_code || null,
        commission_percentage: 100,
      }

      const { error } = await supabase
        .from('leads')
        .insert(leadData)

      if (error) {
        throw error
      }

      toast.success('Lead cadastrado com sucesso!')
      basicForm.reset()
      router.push('/dashboard/leads')
    } catch (error: any) {
      console.error('Erro ao cadastrar lead:', error)
      toast.error(error.message || 'Erro ao cadastrar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Submit para formulário avançado (admin)
  const onAdvancedSubmit = async (data: AdvancedLeadFormData) => {
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
      let originalLeadId = null

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
      advancedForm.reset()
      router.push('/dashboard/leads')
    } catch (error: any) {
      console.error('Erro ao cadastrar lead:', error)
      toast.error(error.message || 'Erro ao cadastrar lead')
    } finally {
      setIsSubmitting(false)
    }
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

  // FORMULÁRIO BÁSICO (consultant/manager)
  if (!isAdvancedForm) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard/leads" className="btn btn-ghost btn-sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Voltar
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-secondary-900">Novo Lead</h1>
              <p className="text-secondary-600">
                Cadastre uma nova indicação
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card max-w-2xl mx-auto"
        >
          <form onSubmit={basicForm.handleSubmit(onBasicSubmit)} className="card-body space-y-6">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-secondary-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                id="full_name"
                {...basicForm.register('full_name')}
                className={`input ${basicForm.formState.errors.full_name ? 'input-error' : ''}`}
                placeholder="Nome completo do lead"
              />
              {basicForm.formState.errors.full_name && (
                <p className="mt-1 text-sm text-danger-600">{basicForm.formState.errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-2">
                Telefone *
              </label>
              <input
                type="tel"
                id="phone"
                {...basicForm.register('phone')}
                className={`input ${basicForm.formState.errors.phone ? 'input-error' : ''}`}
                placeholder="(11) 99999-9999"
              />
              {basicForm.formState.errors.phone && (
                <p className="mt-1 text-sm text-danger-600">{basicForm.formState.errors.phone.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                Email (opcional)
              </label>
              <input
                type="email"
                id="email"
                {...basicForm.register('email')}
                className={`input ${basicForm.formState.errors.email ? 'input-error' : ''}`}
                placeholder="email@exemplo.com"
              />
              {basicForm.formState.errors.email && (
                <p className="mt-1 text-sm text-danger-600">{basicForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-secondary-700 mb-2">
                Observações (opcional)
              </label>
              <textarea
                id="notes"
                {...basicForm.register('notes')}
                rows={3}
                className="input"
                placeholder="Informações adicionais sobre o lead..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-secondary-200">
              <Link href="/dashboard/leads" className="btn btn-secondary">
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
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

  // FORMULÁRIO AVANÇADO (admin) - mantém o código existente
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/leads" className="btn btn-ghost btn-sm">
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

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card max-w-4xl mx-auto"
      >
        <form onSubmit={advancedForm.handleSubmit(onAdvancedSubmit)} className="card-body space-y-8">
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
                  {...advancedForm.register('full_name')}
                  className={`input ${advancedForm.formState.errors.full_name ? 'input-error' : ''}`}
                  placeholder="Nome completo do lead"
                />
                {advancedForm.formState.errors.full_name && (
                  <p className="mt-1 text-sm text-danger-600">{advancedForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-secondary-700 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  id="phone"
                  {...advancedForm.register('phone')}
                  className={`input ${advancedForm.formState.errors.phone ? 'input-error' : ''}`}
                  placeholder="(11) 99999-9999"
                />
                {advancedForm.formState.errors.phone && (
                  <p className="mt-1 text-sm text-danger-600">{advancedForm.formState.errors.phone.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700 mb-2">
                  Email (opcional)
                </label>
                <input
                  type="email"
                  id="email"
                  {...advancedForm.register('email')}
                  className={`input ${advancedForm.formState.errors.email ? 'input-error' : ''}`}
                  placeholder="email@exemplo.com"
                />
                {advancedForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-danger-600">{advancedForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-secondary-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  id="notes"
                  {...advancedForm.register('notes')}
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
                  onClick={() => advancedForm.setValue('indicated_by_type', 'consultant')}
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
                  onClick={() => advancedForm.setValue('indicated_by_type', 'lead')}
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
                      onClick={() => advancedForm.setValue('indicated_by_id', consultant.id)}
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
                      onClick={() => advancedForm.setValue('indicated_by_id', lead.id)}
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
                      {...advancedForm.register('commission_percentage', { valueAsNumber: true })}
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

            {advancedForm.formState.errors.indicated_by_id && (
              <p className="mt-2 text-sm text-danger-600">{advancedForm.formState.errors.indicated_by_id.message}</p>
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
            <Link href="/dashboard/leads" className="btn btn-secondary">
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