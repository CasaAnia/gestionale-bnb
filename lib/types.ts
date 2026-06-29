export type RoomBathroomType = 'privato_interno' | 'privato_esterno'

export interface Room {
  id: string
  name: string
  bathroom_type: RoomBathroomType
  bathroom_note: string | null
  base_price: number
  has_extra_bed: boolean
  extra_bed_price: number
  active: boolean
  created_at: string
}

export type GuestRating = 'ottimo' | 'problematico' | 'vuole_ricevuta' | 'normale'

export interface Guest {
  id: string
  phone: string
  full_name: string | null
  email: string | null
  document_type: string | null
  document_number: string | null
  nationality: string | null
  birth_date: string | null
  birth_place: string | null
  rating: GuestRating
  notes: string | null
  created_at: string
  updated_at: string
}

export type BookingStatus = 'confermata' | 'in_attesa' | 'annullata' | 'completata'

export interface Booking {
  id: string
  room_id: string
  guest_id: string
  check_in: string
  check_out: string
  num_guests: number
  extra_bed: boolean
  price_per_night: number
  extra_bed_total: number
  total_amount: number
  status: BookingStatus
  source: string
  notes: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  group_id: string | null
  created_at: string
  updated_at: string
  rooms?: Room
  guests?: Guest
}

export interface Expense {
  id: string
  category_id: string | null
  expense_date: string
  amount: number
  description: string | null
  source: 'manuale' | 'email'
  created_at: string
  expense_categories?: { name: string }
}

export interface ExpenseCategory {
  id: string
  name: string
}
