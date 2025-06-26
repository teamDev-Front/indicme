import { LeadWithRelations } from "./leads"
import { User } from "./users"

export type CommissionType = 'consultant' | 'manager'
export type CommissionStatus = 'pending' | 'paid' | 'cancelled'

export interface Commission {
  id: string
  lead_id?: string
  user_id: string
  clinic_id: string
  amount: number
  percentage: number
  type: CommissionType
  status: CommissionStatus
  paid_at?: string
  created_at: string
  arcadas_vendidas?: number
}

export interface CommissionWithRelations extends Commission {
  lead?: LeadWithRelations
  user?: User
}