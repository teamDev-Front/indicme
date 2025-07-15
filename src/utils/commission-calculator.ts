// src/utils/commission-calculator.ts
import { createClient } from '@/utils/supabase/client'

interface EstablishmentCommissionSettings {
  consultant_value_per_arcada: number
  consultant_bonus_every_arcadas: number
  consultant_bonus_value: number
  manager_value_per_arcada: number        // 🔥 NOVO: Valor independente
  manager_bonus_active: boolean           // 🔥 NOVO: Switch de bônus
  manager_bonus_35_arcadas: number
  manager_bonus_50_arcadas: number
  manager_bonus_75_arcadas: number
}

interface ConsultantCommissionResult {
  valorBase: number
  bonusGanhos: number
  valorBonus: number
  valorTotal: number
  proximoBonus: number
  arcadasAtuais: number
  arcadasTotais: number
}

interface ManagerCommissionResult {
  comissaoBase: number
  managerBonus: number
  bonusAtivo: boolean
  valorTotal: number
  arcadasEquipe: number
}

export class CommissionCalculator {
  private supabase = createClient()

  // Buscar configurações do estabelecimento
  async getEstablishmentSettings(establishmentCode: string): Promise<EstablishmentCommissionSettings> {
    try {
      const { data, error } = await this.supabase
        .from('establishment_commissions')
        .select('*')
        .eq('establishment_code', establishmentCode)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // Retornar configuração específica ou padrão
      return data || {
        consultant_value_per_arcada: 750,
        consultant_bonus_every_arcadas: 7,
        consultant_bonus_value: 750,
        manager_value_per_arcada: 750,       // 🔥 NOVO: Valor independente
        manager_bonus_active: true,
        manager_bonus_35_arcadas: 5000,
        manager_bonus_50_arcadas: 10000,
        manager_bonus_75_arcadas: 15000,
      }
    } catch (error) {
      console.error('Erro ao buscar configurações do estabelecimento:', error)
      // Retornar configuração padrão em caso de erro
      return {
        consultant_value_per_arcada: 750,
        consultant_bonus_every_arcadas: 7,
        consultant_bonus_value: 750,
        manager_value_per_arcada: 750,       // 🔥 NOVO: Valor independente
        manager_bonus_active: true,    
        manager_bonus_35_arcadas: 5000,
        manager_bonus_50_arcadas: 10000,
        manager_bonus_75_arcadas: 15000,
      }
    }
  }

  // Calcular comissão do consultor
  async calculateConsultantCommission(
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number
  ): Promise<ConsultantCommissionResult> {
    try {
      // Buscar configurações do estabelecimento
      const settings = await this.getEstablishmentSettings(establishmentCode)

      // Buscar arcadas já vendidas pelo consultor neste estabelecimento
      const { data: leadsData } = await this.supabase
        .from('leads')
        .select('arcadas_vendidas')
        .eq('indicated_by', consultantId)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')

      const arcadasAtuais = leadsData?.reduce((sum, lead) => sum + (lead.arcadas_vendidas || 1), 0) || 0
      const arcadasTotais = arcadasAtuais + arcadasVendidas

      // Calcular valor base
      const valorBase = arcadasVendidas * settings.consultant_value_per_arcada

      // Calcular bônus
      const bonusAntes = Math.floor(arcadasAtuais / settings.consultant_bonus_every_arcadas)
      const bonusDepois = Math.floor(arcadasTotais / settings.consultant_bonus_every_arcadas)
      const bonusGanhos = bonusDepois - bonusAntes
      const valorBonus = bonusGanhos * settings.consultant_bonus_value

      // Calcular próximo bônus
      const proximoBonus = settings.consultant_bonus_every_arcadas - (arcadasTotais % settings.consultant_bonus_every_arcadas)

      return {
        valorBase,
        bonusGanhos,
        valorBonus,
        valorTotal: valorBase + valorBonus,
        proximoBonus: proximoBonus === settings.consultant_bonus_every_arcadas ? 0 : proximoBonus,
        arcadasAtuais,
        arcadasTotais
      }
    } catch (error) {
      console.error('Erro ao calcular comissão do consultor:', error)
      throw error
    }
  }

  async calculateManagerCommission(
    managerId: string,
    establishmentCode: string,
    arcadasAdicionadas: number
  ): Promise<ManagerCommissionResult> {
    try {
      // Buscar configurações do estabelecimento
      const settings = await this.getEstablishmentSettings(establishmentCode)

      // Buscar IDs dos consultores da equipe
      const { data: hierarchyData } = await this.supabase
        .from('hierarchies')
        .select('consultant_id')
        .eq('manager_id', managerId)

      const consultantIds = hierarchyData?.map(h => h.consultant_id) || []

      // Buscar leads convertidos da equipe neste estabelecimento
      const { data: teamLeads } = await this.supabase
        .from('leads')
        .select('arcadas_vendidas')
        .in('indicated_by', consultantIds)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')

      const totalArcadasEquipe = teamLeads?.reduce((sum, lead) => sum + (lead.arcadas_vendidas || 1), 0) || 0

      // 🔥 NOVA LÓGICA: Usar valor independente do gerente
      const comissaoBaseEquipe = arcadasAdicionadas * settings.manager_value_per_arcada

      let managerBonus = 0

      // Calcular bônus apenas se estiver ativo
      if (settings.manager_bonus_active) {
        const arcadasTotaisAntes = totalArcadasEquipe
        const arcadasTotaisDepois = totalArcadasEquipe + arcadasAdicionadas

        // Verificar marcos de 35, 50, 75 arcadas
        const marcos = [
          { arcadas: 35, bonus: settings.manager_bonus_35_arcadas },
          { arcadas: 50, bonus: settings.manager_bonus_50_arcadas },
          { arcadas: 75, bonus: settings.manager_bonus_75_arcadas }
        ]

        for (const marco of marcos) {
          const marcosAntes = Math.floor(arcadasTotaisAntes / marco.arcadas)
          const marcosDepois = Math.floor(arcadasTotaisDepois / marco.arcadas)
          const novosMarcos = marcosDepois - marcosAntes

          if (novosMarcos > 0) {
            managerBonus += novosMarcos * marco.bonus
          }
        }
      }

      return {
        comissaoBase: comissaoBaseEquipe,
        managerBonus,
        valorTotal: comissaoBaseEquipe + managerBonus,
        arcadasEquipe: totalArcadasEquipe + arcadasAdicionadas,
        bonusAtivo: settings.manager_bonus_active
      }
    } catch (error) {
      console.error('Erro ao calcular comissão do gerente:', error)
      throw error
    }
  }

  // Processar conversão de lead - ATUALIZADO
  async processLeadConversion(
    leadId: string,
    arcadasVendidas: number,
    establishmentCode: string
  ): Promise<{
    consultantCommission: ConsultantCommissionResult
    managerCommission?: ManagerCommissionResult
    commissionsCreated: string[]
  }> {
    try {
      // Buscar informações do lead
      const { data: lead, error: leadError } = await this.supabase
        .from('leads')
        .select('indicated_by, clinic_id')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        throw new Error('Lead não encontrado')
      }

      // Atualizar lead para convertido
      const { error: updateLeadError } = await this.supabase
        .from('leads')
        .update({
          status: 'converted',
          arcadas_vendidas: arcadasVendidas,
          establishment_code: establishmentCode,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)

      if (updateLeadError) throw updateLeadError

      // Calcular comissão do consultor
      const consultantCommission = await this.calculateConsultantCommission(
        lead.indicated_by,
        establishmentCode,
        arcadasVendidas
      )

      const commissionsCreated: string[] = []

      // Criar comissão do consultor
      const { data: consultantCommissionData, error: consultantCommissionError } = await this.supabase
        .from('commissions')
        .insert({
          lead_id: leadId,
          user_id: lead.indicated_by,
          clinic_id: lead.clinic_id,
          establishment_code: establishmentCode,
          amount: consultantCommission.valorTotal,
          percentage: 0,
          type: 'consultant',
          status: 'pending',
          arcadas_vendidas: arcadasVendidas,
          valor_por_arcada: consultantCommission.valorBase / arcadasVendidas,
          bonus_conquistados: consultantCommission.bonusGanhos,
          valor_bonus: consultantCommission.valorBonus
        })
        .select('id')
        .single()

      if (consultantCommissionError) throw consultantCommissionError
      commissionsCreated.push(consultantCommissionData.id)

      // Verificar se consultor tem gerente
      const { data: hierarchyData } = await this.supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', lead.indicated_by)
        .single()

      let managerCommission: ManagerCommissionResult | undefined

      if (hierarchyData?.manager_id) {
        // Calcular comissão do gerente
        managerCommission = await this.calculateManagerCommission(
          hierarchyData.manager_id,
          establishmentCode,
          arcadasVendidas
        )

        // Criar comissão do gerente apenas se houver valor
        if (managerCommission.valorTotal > 0) {
          // 🔥 ATUALIZADO: Buscar configurações para obter valor por arcada do gerente
          const settings = await this.getEstablishmentSettings(establishmentCode)

          const { data: managerCommissionData, error: managerCommissionError } = await this.supabase
            .from('commissions')
            .insert({
              lead_id: leadId,
              user_id: hierarchyData.manager_id,
              clinic_id: lead.clinic_id,
              establishment_code: establishmentCode,
              amount: managerCommission.valorTotal,
              percentage: 0,
              type: 'manager',
              status: 'pending',
              arcadas_vendidas: arcadasVendidas,
              valor_por_arcada: settings.manager_value_per_arcada,  // 🔥 NOVO: Usar valor do gerente
              bonus_conquistados: managerCommission.managerBonus > 0 ? 1 : 0,
              valor_bonus: managerCommission.managerBonus
            })
            .select('id')
            .single()

          if (managerCommissionError) throw managerCommissionError
          commissionsCreated.push(managerCommissionData.id)
        }
      }

      return {
        consultantCommission,
        managerCommission,
        commissionsCreated
      }
    } catch (error) {
      console.error('Erro ao processar conversão:', error)
      throw error
    }
  }

  // Simular comissões sem salvar no banco
  async simulateCommissions(
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number
  ): Promise<{
    consultant: ConsultantCommissionResult
    manager?: ManagerCommissionResult
  }> {
    try {
      const consultant = await this.calculateConsultantCommission(
        consultantId,
        establishmentCode,
        arcadasVendidas
      )

      // Verificar se consultor tem gerente
      const { data: hierarchyData } = await this.supabase
        .from('hierarchies')
        .select('manager_id')
        .eq('consultant_id', consultantId)
        .single()

      let manager: ManagerCommissionResult | undefined

      if (hierarchyData?.manager_id) {
        manager = await this.calculateManagerCommission(
          hierarchyData.manager_id,
          establishmentCode,
          arcadasVendidas
        )
      }

      return { consultant, manager }
    } catch (error) {
      console.error('Erro ao simular comissões:', error)
      throw error
    }
  }
}

// Hook para usar o calculador em componentes React
import { useState } from 'react'

export function useCommissionCalculator() {
  const [calculator] = useState(() => new CommissionCalculator())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculateConsultantCommission = async (
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number
  ) => {
    try {
      setLoading(true)
      setError(null)
      return await calculator.calculateConsultantCommission(consultantId, establishmentCode, arcadasVendidas)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const calculateManagerCommission = async (
    managerId: string,
    establishmentCode: string,
    arcadasAdicionadas: number
  ) => {
    try {
      setLoading(true)
      setError(null)
      return await calculator.calculateManagerCommission(managerId, establishmentCode, arcadasAdicionadas)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const processLeadConversion = async (
    leadId: string,
    arcadasVendidas: number,
    establishmentCode: string
  ) => {
    try {
      setLoading(true)
      setError(null)
      return await calculator.processLeadConversion(leadId, arcadasVendidas, establishmentCode)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const simulateCommissions = async (
    consultantId: string,
    establishmentCode: string,
    arcadasVendidas: number
  ) => {
    try {
      setLoading(true)
      setError(null)
      return await calculator.simulateCommissions(consultantId, establishmentCode, arcadasVendidas)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getEstablishmentSettings = async (establishmentCode: string) => {
    try {
      setLoading(true)
      setError(null)
      return await calculator.getEstablishmentSettings(establishmentCode)
    } catch (err: any) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    calculateConsultantCommission,
    calculateManagerCommission,
    processLeadConversion,
    simulateCommissions,
    getEstablishmentSettings,
    loading,
    error
  }
}