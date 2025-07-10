// src/utils/commission-calculator.ts
import { createClient } from '@/utils/supabase/client'

interface EstablishmentCommissionSettings {
  consultant_value_per_arcada: number
  consultant_bonus_every_arcadas: number
  consultant_bonus_value: number
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
  bonus35Ganhos: number
  bonus50Ganhos: number
  bonus75Ganhos: number
  valorTotal: number
  arcadasEquipe: number
  proximoMarco: {
    tipo: '35' | '50' | '75' | 'completo'
    faltam: number
  }
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

  // Calcular comissão do gerente
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
      consultantIds.push(managerId) // Incluir próprio gerente

      // Buscar total de arcadas da equipe neste estabelecimento
      const { data: leadsData } = await this.supabase
        .from('leads')
        .select('arcadas_vendidas')
        .in('indicated_by', consultantIds)
        .eq('establishment_code', establishmentCode)
        .eq('status', 'converted')

      const arcadasEquipe = leadsData?.reduce((sum, lead) => sum + (lead.arcadas_vendidas || 1), 0) || 0
      const arcadasTotais = arcadasEquipe + arcadasAdicionadas

      // Calcular bônus do gerente (marcos de 35, 50, 75)
      const bonus35Antes = Math.floor(arcadasEquipe / 35)
      const bonus50Antes = Math.floor(arcadasEquipe / 50)
      const bonus75Antes = Math.floor(arcadasEquipe / 75)

      const bonus35Depois = Math.floor(arcadasTotais / 35)
      const bonus50Depois = Math.floor(arcadasTotais / 50)
      const bonus75Depois = Math.floor(arcadasTotais / 75)

      const bonus35Ganhos = bonus35Depois - bonus35Antes
      const bonus50Ganhos = bonus50Depois - bonus50Antes
      const bonus75Ganhos = bonus75Depois - bonus75Antes

      // Calcular valores
      const valor35 = bonus35Ganhos * (settings.consultant_value_per_arcada + settings.manager_bonus_35_arcadas)
      const valor50 = bonus50Ganhos * (settings.consultant_value_per_arcada + settings.manager_bonus_50_arcadas)
      const valor75 = bonus75Ganhos * (settings.consultant_value_per_arcada + settings.manager_bonus_75_arcadas)

      // Determinar próximo marco
      let proximoMarco: { tipo: '35' | '50' | '75' | 'completo', faltam: number }
      
      if (arcadasTotais < 35) {
        proximoMarco = { tipo: '35', faltam: 35 - arcadasTotais }
      } else if (arcadasTotais < 50) {
        proximoMarco = { tipo: '50', faltam: 50 - arcadasTotais }
      } else if (arcadasTotais < 75) {
        proximoMarco = { tipo: '75', faltam: 75 - arcadasTotais }
      } else {
        // Próximo ciclo
        const proximoCiclo35 = Math.ceil(arcadasTotais / 35) * 35
        proximoMarco = { tipo: '35', faltam: proximoCiclo35 - arcadasTotais }
      }

      return {
        bonus35Ganhos,
        bonus50Ganhos,
        bonus75Ganhos,
        valorTotal: valor35 + valor50 + valor75,
        arcadasEquipe: arcadasTotais,
        proximoMarco
      }
    } catch (error) {
      console.error('Erro ao calcular comissão do gerente:', error)
      throw error
    }
  }

  // Processar conversão de lead com cálculo automático de comissões
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
          percentage: 0, // Campo obrigatório mas não usado
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
          const { data: managerCommissionData, error: managerCommissionError } = await this.supabase
            .from('commissions')
            .insert({
              lead_id: leadId,
              user_id: hierarchyData.manager_id,
              clinic_id: lead.clinic_id,
              establishment_code: establishmentCode,
              amount: managerCommission.valorTotal,
              percentage: 0, // Campo obrigatório mas não usado
              type: 'manager',
              status: 'pending',
              arcadas_vendidas: arcadasVendidas
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