// src/utils/commission-processor.ts
import { createClient } from '@/utils/supabase/client'
import toast from 'react-hot-toast'

interface LeadConversionData {
  leadId: string
  arcadasVendidas: number
  establishmentCode: string
}

interface CommissionResult {
  consultantCommission: number
  managerCommission?: number
  indicationCommission?: number
  commissionsCreated: string[]
  bonusGained: boolean
}

export class CommissionProcessor {
  private supabase = createClient()

  async processLeadConversion(data: LeadConversionData): Promise<CommissionResult> {
    const { leadId, arcadasVendidas, establishmentCode } = data

    try {
      // 1. Buscar informações do lead
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select(`
          *,
          lead_indications_original!original_lead_id (
            id,
            new_lead_id,
            commission_percentage,
            created_by
          )
        `)
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        throw new Error('Lead não encontrado')
      }

      // 2. Atualizar lead para convertido
      const { error: updateError } = await this.supabase
        .from('leads')
        .update({
          status: 'converted',
          arcadas_vendidas: arcadasVendidas,
          establishment_code: establishmentCode,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (updateError) throw updateError

      // 3. Buscar configurações do estabelecimento
      const { data: settings } = await this.supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      const valorPorArcada = settings?.consultant_value_per_arcada || 750
      const bonusACada = settings?.consultant_bonus_every_arcadas || 7
      const valorBonus = settings?.consultant_bonus_value || 750

      // 4. Calcular comissão do consultor
      const comissaoBase = arcadasVendidas * valorPorArcada

      // Verificar bônus
      const { data: arcadasAtuais } = await this.supabase
        .from('leads')
        .select('arcadas_vendidas')
        .eq('indicated_by', lead.indicated_by)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')
        .neq('id', leadId) // Excluir o lead atual

      const arcadasJaVendidas = arcadasAtuais?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
      const arcadasTotais = arcadasJaVendidas + arcadasVendidas

      const bonusAntes = Math.floor(arcadasJaVendidas / bonusACada)
      const bonusDepois = Math.floor(arcadasTotais / bonusACada)
      const novosBonus = bonusDepois - bonusAntes
      const valorBonusTotal = novosBonus * valorBonus

      const comissaoConsultorTotal = comissaoBase + valorBonusTotal

      const commissionsCreated: string[] = []

      // 5. Criar comissão do consultor
      const { data: consultantCommission, error: consultantError } = await this.supabase
        .from('commissions')
        .insert({
          lead_id: leadId,
          user_id: lead.indicated_by,
          clinic_id: lead.clinic_id,
          establishment_code: establishmentCode,
          amount: comissaoConsultorTotal,
          percentage: 0, // Campo obrigatório mas não usado
          type: 'consultant',
          status: 'pending',
          arcadas_vendidas: arcadasVendidas,
          valor_por_arcada: valorPorArcada,
          bonus_conquistados: novosBonus,
          valor_bonus: valorBonusTotal
        })
        .select('id')
        .single()

      if (consultantError) throw consultantError
      commissionsCreated.push(consultantCommission.id)

      // 6. Verificar se foi indicado por outro lead (comissão de indicação)
      let indicationCommission = 0
      if (lead.indication_type === 'lead' && lead.original_lead_id) {
        const percentage = lead.commission_percentage || 50
        indicationCommission = (comissaoConsultorTotal * percentage) / 100

        const { data: indicationCommissionData, error: indicationError } = await this.supabase
          .from('commissions')
          .insert({
            lead_id: leadId,
            user_id: lead.indicated_by, // Mesmo consultor, mas com percentual diferente
            clinic_id: lead.clinic_id,
            establishment_code: establishmentCode,
            amount: indicationCommission,
            percentage: percentage,
            type: 'consultant',
            status: 'pending',
            arcadas_vendidas: arcadasVendidas,
            valor_por_arcada: (valorPorArcada * percentage) / 100,
            // Marcar como comissão de indicação
            is_indication_commission: true,
            original_lead_id: lead.original_lead_id
          })
          .select('id')
          .single()

        if (indicationError) throw indicationError
        commissionsCreated.push(indicationCommissionData.id)

        // Atualizar registro de indicação
        await this.supabase
          .from('lead_indications')
          .update({
            commission_amount: indicationCommission,
            processed_at: new Date().toISOString()
          })
          .eq('original_lead_id', lead.original_lead_id)
          .eq('new_lead_id', leadId)
      }

      // 7. Verificar se consultor tem gerente
      const { data: hierarchy } = await this.supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', lead.indicated_by)
        .single()

      let managerCommission = 0
      if (hierarchy?.manager_id) {
        // 🔥 NOVA LÓGICA: Gerente ganha o mesmo valor por arcada que consultores
        const managerBaseCommission = arcadasVendidas * valorPorArcada

        let managerBonus = 0

        // Verificar se bônus está ativo para este estabelecimento
        const { data: establishmentSettings } = await this.supabase
          .from('establishment_commissions')
          .select('manager_bonus_active, manager_bonus_35_arcadas, manager_bonus_50_arcadas, manager_bonus_75_arcadas')
          .eq('establishment_code', establishmentCode)
          .single()

        const bonusAtivo = establishmentSettings?.manager_bonus_active !== false

        if (bonusAtivo) {
          // Calcular total de arcadas da equipe do gerente
          const { data: teamMembers } = await this.supabase
            .from('hierarchies')
            .select('consultant_id')
            .eq('manager_id', hierarchy.manager_id)

          const teamIds = teamMembers?.map(t => t.consultant_id) || []
          teamIds.push(hierarchy.manager_id) // Incluir o próprio gerente

          const { data: teamLeads } = await this.supabase
            .from('leads')
            .select('arcadas_vendidas')
            .in('indicated_by', teamIds)
            .eq('establishment_code', establishmentCode)
            .eq('status', 'converted')

          const totalArcadasAntes = teamLeads?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
          const totalArcadasDepois = totalArcadasAntes + arcadasVendidas

          // Verificar marcos de bônus
          const marcos = [
            { arcadas: 35, bonus: establishmentSettings?.manager_bonus_35_arcadas || 5000 },
            { arcadas: 50, bonus: establishmentSettings?.manager_bonus_50_arcadas || 10000 },
            { arcadas: 75, bonus: establishmentSettings?.manager_bonus_75_arcadas || 15000 }
          ]

          for (const marco of marcos) {
            const marcosAntes = Math.floor(totalArcadasAntes / marco.arcadas)
            const marcosDepois = Math.floor(totalArcadasDepois / marco.arcadas)
            const novosMarcos = marcosDepois - marcosAntes

            if (novosMarcos > 0) {
              managerBonus += novosMarcos * marco.bonus
            }
          }
        }

        const managerTotalCommission = managerBaseCommission + managerBonus
        managerCommission = managerTotalCommission

        if (managerTotalCommission > 0) {
          const { data: managerCommissionData, error: managerError } = await this.supabase
            .from('commissions')
            .insert({
              lead_id: leadId,
              user_id: hierarchy.manager_id,
              clinic_id: lead.clinic_id,
              establishment_code: establishmentCode,
              amount: managerTotalCommission,
              percentage: 0,
              type: 'manager',
              status: 'pending',
              arcadas_vendidas: arcadasVendidas,
              valor_por_arcada: valorPorArcada,
              bonus_conquistados: managerBonus > 0 ? 1 : 0,
              valor_bonus: managerBonus
            })
            .select('id')
            .single()

          if (managerError) throw managerError
          commissionsCreated.push(managerCommissionData.id)
        }
      }

      return {
        consultantCommission: comissaoConsultorTotal,
        managerCommission,
        indicationCommission,
        commissionsCreated,
        bonusGained: novosBonus > 0
      }

    } catch (error) {
      console.error('Erro ao processar conversão:', error)
      throw error
    }
  }

  async calculateCommissionPreview(
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number,
    isIndication: boolean = false,
    indicationPercentage: number = 100
  ) {
    try {
      // Buscar configurações
      const { data: settings } = await this.supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      const valorPorArcada = settings?.consultant_value_per_arcada || 750
      const bonusACada = settings?.consultant_bonus_every_arcadas || 7
      const valorBonus = settings?.consultant_bonus_value || 750

      // Calcular valor base
      const valorBase = arcadasVendidas * valorPorArcada

      // Calcular bônus
      const { data: arcadasAtuais } = await this.supabase
        .from('leads')
        .select('arcadas_vendidas')
        .eq('indicated_by', consultantId)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')

      const arcadasJaVendidas = arcadasAtuais?.reduce((sum, l) => sum + (l.arcadas_vendidas || 1), 0) || 0
      const arcadasTotais = arcadasJaVendidas + arcadasVendidas

      const bonusAntes = Math.floor(arcadasJaVendidas / bonusACada)
      const bonusDepois = Math.floor(arcadasTotais / bonusACada)
      const novosBonus = bonusDepois - bonusAntes
      const valorBonusTotal = novosBonus * valorBonus

      const valorTotal = valorBase + valorBonusTotal

      // Aplicar percentual se for indicação
      const valorFinal = isIndication ? (valorTotal * indicationPercentage) / 100 : valorTotal

      return {
        valorBase,
        valorBonus: valorBonusTotal,
        novosBonus,
        valorTotal,
        valorFinal,
        percentage: indicationPercentage,
        proximoBonus: bonusACada - (arcadasTotais % bonusACada),
        arcadasAtuais: arcadasJaVendidas,
        arcadasTotais
      }
    } catch (error) {
      console.error('Erro ao calcular preview:', error)
      throw error
    }
  }
}

// Hook para usar em componentes React
import { useState } from 'react'

export function useCommissionProcessor() {
  const [processor] = useState(() => new CommissionProcessor())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processConversion = async (data: LeadConversionData) => {
    try {
      setProcessing(true)
      setError(null)

      const result = await processor.processLeadConversion(data)

      // Feedback personalizado baseado no resultado
      let message = `Lead convertido! Comissão de R$ ${result.consultantCommission.toFixed(2)}`

      if (result.bonusGained) {
        message += ' + bônus conquistado! 🎉'
      }

      if (result.indicationCommission) {
        message += ` (${(result.indicationCommission / result.consultantCommission * 100).toFixed(0)}% por indicação)`
      }

      if (result.managerCommission) {
        message += ` + R$ ${result.managerCommission.toFixed(2)} para o gerente`
      }

      toast.success(message, { duration: 6000 })

      return result
    } catch (err: any) {
      setError(err.message)
      toast.error(`Erro ao processar conversão: ${err.message}`)
      throw err
    } finally {
      setProcessing(false)
    }
  }

  const calculatePreview = async (
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number,
    isIndication?: boolean,
    indicationPercentage?: number
  ) => {
    try {
      setError(null)
      return await processor.calculateCommissionPreview(
        consultantId,
        establishmentCode,
        arcadasVendidas,
        isIndication,
        indicationPercentage
      )
    } catch (err: any) {
      setError(err.message)
      throw err
    }
  }

  return {
    processConversion,
    calculatePreview,
    processing,
    error
  }
}