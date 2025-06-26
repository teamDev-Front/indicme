import { Gender } from "./leads"

export interface EstablishmentFormData {
  code: string
  name: string
  description: string
  address: string
  city: string
  state: string
  phone: string
  email: string
}

export interface ManagerFormData {
  full_name: string
  email: string
  phone: string
  establishment_name: string
  password: string
}

export interface ConsultantFormData {
  full_name: string
  email: string
  phone: string
  password: string
  establishment_codes: string[]
}

export interface LeadFormData {
  full_name: string
  email: string
  phone: string
  cpf: string
  address: string
  city: string
  state: string
  zip_code: string
  age: number
  gender: Gender
  notes: string
  establishment_code: string
  arcadas_vendidas: number
}