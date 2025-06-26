export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'converted' | 'lost'
export type Gender = 'male' | 'female' | 'other'

export interface Lead {
  id: string
  full_name: string
  email?: string
  phone: string
  cpf?: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
  age?: number
  gender?: Gender
  notes?: string
  status: LeadStatus
  indicated_by: string
  clinic_id: string
  establishment_code?: string
  arcadas_vendidas?: number
  created_at: string
  updated_at: string
}

export interface LeadWithRelations extends Lead {
  consultant?: {
    id: string
    full_name: string
    email: string
  }
  establishment?: {
    code: string
    name: string
  }
}