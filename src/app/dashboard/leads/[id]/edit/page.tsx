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
import { ArrowLeftIcon, CheckBadgeIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

const leadSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  age: z.number().min(1).max(120).optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional(),
  status: z.enum(['new', 'contacted', 'scheduled', 'converted', 'lost']),
  notes: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

interface Lead {
  id: string
  full_name: string
  phone: string
  email: string | null
  cpf: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  age: number | null
  gender: 'male' | 'female' | 'other' | null
  status: 'new' | 'contacted' | 'scheduled' | 'converted' | 'lost'
  notes: string | null
  indicated_by: string
  clinic_id: string
  created_at: string
  updated_at: string
}

export default function EditLeadPage({ params }: { params: { id: string } }) {
  const { profile } = useAuth()
  const router = useRouter()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  })

  useEffect(() => {
    if (params.id) {
      fetchLead()
    }
  }, [params.id])

  const fetchLead = async () => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error

      // Verificar se o usuário pode editar este lead
      const canEdit = profile?.role === 'clinic_admin' || 
                     profile?.role === 'manager' || 
                     (profile?.role === 'consultant' && data.indicated_by === profile.id)

      if (!canEdit) {
        toast.error('Você não tem permissão para editar este lead')
        router.push('/dashboard/leads')
        return
      }

      setLead(data)
      
      // Preencher o formulário
      reset({
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || '',
        cpf: data.cpf || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        age: data.age || '',
        gender: data.gender || undefined,
        status: data.status,
        notes: data.notes || '',
      })

    } catch (error: any) {
      console.error('Erro ao buscar lead:', error)
      toast.error('Lead não encontrado')
      router.push('/dashboard/leads')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: LeadFormData) => {
    if (!lead) return

    try {
      setIsSubmitting(true)

      const updateData = {
        full_name: data.full_name,
        phone: data.phone,
        email: data.email || null,
        cpf: data.cpf || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        age: data.age || null,
        gender: data.gender || null,
        status: data.status,
        notes: data.notes || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead.id)

      if (error) throw error

      toast.success('Lead atualizado com sucesso!')
      router.push('/dashboard/leads')

    } catch (error: any) {
      console.error('Erro ao atualizar lead:', error)
      toast.error(error.message || 'Erro ao atualizar lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8"></div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-secondary-900 mb-2">Lead não encontrado</h3>
        <Link href="/dashboard/leads" className="btn btn-primary">
          Voltar para Leads
        </Link>
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold text-secondary-900">Editar Lead</h1>
            <p className="text-secondary-600">
              Atualize as informações do lead {lead.full_name}
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
        <form onSubmit={handleSubmit(onSubmit)} className="card-body space-y-6">
          {/* Informações Básicas */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Informações Básicas
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
                  Email
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
                <label htmlFor="cpf" className="block text-sm font-medium text-secondary-700 mb-2">
                  CPF
                </label>
                <input
                  type="text"
                  id="cpf"
                  {...register('cpf')}
                  className="input"
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
          </div>

          {/* Dados Pessoais */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-secondary-700 mb-2">
                  Idade
                </label>
                <input
                  type="number"
                  id="age"
                  {...register('age', { valueAsNumber: true })}
                  className="input"
                  placeholder="35"
                  min="1"
                  max="120"
                />
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-secondary-700 mb-2">
                  Gênero
                </label>
                <select
                  id="gender"
                  {...register('gender')}
                  className="input"
                >
                  <option value="">Selecione</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-secondary-700 mb-2">
                  Status *
                </label>
                <select
                  id="status"
                  {...register('status')}
                  className="input"
                >
                  <option value="new">Novo</option>
                  <option value="contacted">Contatado</option>
                  <option value="scheduled">Agendado</option>
                  <option value="converted">Convertido</option>
                  <option value="lost">Perdido</option>
                </select>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-secondary-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  id="address"
                  {...register('address')}
                  className="input"
                  placeholder="Rua, número, complemento"
                />
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-secondary-700 mb-2">
                  Cidade
                </label>
                <input
                  type="text"
                  id="city"
                  {...register('city')}
                  className="input"
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-secondary-700 mb-2">
                  Estado
                </label>
                <input
                  type="text"
                  id="state"
                  {...register('state')}
                  className="input"
                  placeholder="SP"
                  maxLength={2}
                />
              </div>

              <div>
                <label htmlFor="zip_code" className="block text-sm font-medium text-secondary-700 mb-2">
                  CEP
                </label>
                <input
                  type="text"
                  id="zip_code"
                  {...register('zip_code')}
                  className="input"
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-secondary-700 mb-2">
              Observações
            </label>
            <textarea
              id="notes"
              {...register('notes')}
              rows={4}
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
                <>
                  <CheckBadgeIcon className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}