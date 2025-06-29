// utils/clinic-validation.ts
import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'

interface ClinicValidationResult {
  clinicId: string | null
  error: string | null
  success: boolean
}

export async function validateUserClinic(
  userId: string, 
  userRole: string
): Promise<ClinicValidationResult> {
  const supabase = createClient()

  try {
    console.log(`🔍 Validando clínica para usuário ${userId} (role: ${userRole})`)

    // Para super admins, tentar diferentes estratégias
    if (userRole === 'clinic_admin') {
      // Estratégia 1: Buscar via user_clinics
      const { data: userClinic, error: userClinicError } = await supabase
        .from('user_clinics')
        .select('clinic_id, clinics!inner(id, name, status)')
        .eq('user_id', userId)
        .eq('clinics.status', 'active')
        .maybeSingle()

      if (userClinic && userClinic.clinic_id) {
        console.log('✅ Clínica encontrada via user_clinics')
        return {
          clinicId: userClinic.clinic_id,
          error: null,
          success: true
        }
      }

      console.log('⚠️ Não encontrou via user_clinics, buscando clínicas disponíveis...')

      // Estratégia 2: Buscar primeira clínica ativa e associar
      const { data: availableClinics, error: clinicsError } = await supabase
        .from('clinics')
        .select('id, name')
        .eq('status', 'active')
        .limit(1)

      if (clinicsError) {
        return {
          clinicId: null,
          error: `Erro ao buscar clínicas: ${clinicsError.message}`,
          success: false
        }
      }

      if (availableClinics && availableClinics.length > 0) {
        const clinicId = availableClinics[0].id

        // Tentar associar o admin automaticamente
        const { error: associationError } = await supabase
          .from('user_clinics')
          .upsert({
            user_id: userId,
            clinic_id: clinicId
          }, {
            onConflict: 'user_id,clinic_id',
            ignoreDuplicates: true
          })

        if (associationError) {
          console.warn('Não conseguiu associar automaticamente:', associationError)
          // Mesmo assim, retornar a clínica encontrada
        } else {
          console.log('✅ Admin associado automaticamente à clínica')
        }

        return {
          clinicId: clinicId,
          error: null,
          success: true
        }
      }

      // Estratégia 3: Criar clínica padrão se não existir nenhuma
      console.log('⚠️ Nenhuma clínica ativa encontrada, criando clínica padrão...')

      const { data: newClinic, error: createError } = await supabase
        .from('clinics')
        .insert({
          name: 'Clínica Principal',
          status: 'active'
        })
        .select('id')
        .single()

      if (createError) {
        return {
          clinicId: null,
          error: `Erro ao criar clínica padrão: ${createError.message}`,
          success: false
        }
      }

      // Associar admin à nova clínica
      await supabase
        .from('user_clinics')
        .insert({
          user_id: userId,
          clinic_id: newClinic.id
        })

      console.log('✅ Clínica padrão criada e admin associado')

      return {
        clinicId: newClinic.id,
        error: null,
        success: true
      }
    }

    // Para outros roles (manager, consultant, etc.)
    const { data: userClinic, error: userClinicError } = await supabase
      .from('user_clinics')
      .select('clinic_id, clinics!inner(id, name, status)')
      .eq('user_id', userId)
      .eq('clinics.status', 'active')
      .maybeSingle()

    if (userClinicError) {
      return {
        clinicId: null,
        error: `Erro ao buscar associação com clínica: ${userClinicError.message}`,
        success: false
      }
    }

    if (!userClinic) {
      return {
        clinicId: null,
        error: 'Usuário não está associado a nenhuma clínica ativa',
        success: false
      }
    }

    return {
      clinicId: userClinic.clinic_id,
      error: null,
      success: true
    }

  } catch (error: any) {
    console.error('❌ Erro na validação de clínica:', error)
    return {
      clinicId: null,
      error: error.message || 'Erro desconhecido na validação',
      success: false
    }
  }
}

// Hook para usar em componentes React
export function useClinicValidation() {
  const [clinicValidation, setClinicValidation] = useState<ClinicValidationResult>({
    clinicId: null,
    error: null,
    success: false
  })
  const [loading, setLoading] = useState(false)

  const validateClinic = async (userId: string, userRole: string) => {
    setLoading(true)
    const result = await validateUserClinic(userId, userRole)
    setClinicValidation(result)
    setLoading(false)
    return result
  }

  return {
    clinicValidation,
    validateClinic,
    loading
  }
}