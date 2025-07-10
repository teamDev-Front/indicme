export interface EstablishmentCode {
  id: string
  code: string
  name: string
  description?: string
  address?: string
  city?: string
  state?: string
  phone?: string
  email?: string
  is_active: boolean
  created_at: string
  updated_at: string
  commission_settings?: EstablishmentCommissionSettings
}

export interface EstablishmentCommissionSettings {
  id?: string
  clinic_id: string
  value_per_arcada: number
  bonus_a_cada_arcadas: number
  valor_bonus: number
  created_at?: string
  updated_at?: string
}

export interface EstablishmentWithStats extends EstablishmentCode {
  _stats: {
    users_count: number
    leads_count: number
    revenue?: number
  }
}

export interface UserEstablishment {
  id: string
  user_id: string
  establishment_code: string
  status: 'active' | 'inactive'
  added_by?: string
  joined_at: string
  created_at: string
}