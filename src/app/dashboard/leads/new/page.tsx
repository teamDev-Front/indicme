'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

const leadSchema = z.object({
  full_name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  cpf: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  age: z.number().min(1).max(120).optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  notes: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

export default function NewLeadPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  })

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

      // Preparar dados do lead
      const leadData = {
        ...data,
        email: data.email || null,
        cpf: data.cpf || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zip_code: data.zip_code || null,
        age: data.age || null,
        gender: data.gender || null,
        notes: data.notes || null,
        indicated_by: profile.id,
        clinic_id: userClinic.clinic_id,
        status: 'new' as const,
      }

      const { error } = await supabase
        .from('leads')
        .insert(leadData)

      if (error) {
        throw error
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
              Novo Lead
            </h1>
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
        className="card"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="card-body space-y-6">
          {/* Informações Básicas */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Informações Básicas
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
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

          {/* Informações Pessoais */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Informações Pessoais
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <label htmlFor="age" className="block text-sm font-medium text-secondary-700 mb-2">
                  Idade
                </label>
                <input
                  type="number"
                  id="age"
                  {...register('age', { valueAsNumber: true })}
                  className="input"
                  placeholder="25"
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
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-medium text-secondary-900 mb-4">
              Endereço
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="address" className="block text-sm font-medium text-secondary-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  id="address"
                  {...register('address')}
                  className="input"
                  placeholder="Rua, número, bairro"
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
            <Link
              href="/dashboard/leads"
              className="btn btn-secondary"
            >
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