export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export interface TableColumn<T> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: any, item: T) => React.ReactNode
}

export interface FilterOptions {
  searchTerm: string
  statusFilter: string
  establishmentFilter: string
  dateRange?: {
    start: Date
    end: Date
  }
}