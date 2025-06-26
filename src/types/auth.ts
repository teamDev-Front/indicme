export type UserRole = 'clinic_admin' | 'clinic_viewer' | 'manager' | 'consultant'
export type UserStatus = 'active' | 'inactive' | 'pending'

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: UserStatus
}