import { UserRole, UserStatus } from "./auth"

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface Manager extends User {
  role: 'manager'
  establishment_name?: string
  _count?: {
    consultants: number
    leads: number
    commissions: number
  }
  _stats?: {
    totalCommissions: number
    conversionRate: number
  }
}

export interface Consultant extends User {
  role: 'consultant'
  establishment_count?: number
  establishment_names?: string[]
  _count?: {
    leads: number
    arcadas_vendidas: number
  }
  manager?: {
    id: string
    full_name: string
    establishment_name?: string
  }
}

export interface Hierarchy {
  id: string
  manager_id: string
  consultant_id: string
  clinic_id: string
  created_at: string
}
