export interface ApiResponse<T> {
  data: T | null
  error: string | null
  loading: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  limit: number
  hasMore: boolean
}

export interface StatsResponse {
  total: number
  active: number
  inactive: number
  [key: string]: number
}