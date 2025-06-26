import { EstablishmentCode, UserEstablishment } from "./establishments"
import { Lead } from "./leads"
import { Commission } from "./commissions"
import { Hierarchy, User } from "./users"

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id'>>
      }
      establishment_codes: {
        Row: EstablishmentCode
        Insert: Omit<EstablishmentCode, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<EstablishmentCode, 'id'>>
      }
      user_establishments: {
        Row: UserEstablishment
        Insert: Omit<UserEstablishment, 'id' | 'created_at'>
        Update: Partial<Omit<UserEstablishment, 'id'>>
      }
      leads: {
        Row: Lead
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lead, 'id'>>
      }
      commissions: {
        Row: Commission
        Insert: Omit<Commission, 'id' | 'created_at'>
        Update: Partial<Omit<Commission, 'id'>>
      }
      hierarchies: {
        Row: Hierarchy
        Insert: Omit<Hierarchy, 'id' | 'created_at'>
        Update: Partial<Omit<Hierarchy, 'id'>>
      }
    }
  }
}