export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          file_path: string
          thumbnail_path: string | null
          file_size: number | null
          duration_seconds: number | null
          is_public: boolean
          payment_type: 'free' | 'paid'
          price_cents: number | null
          currency: 'EUR' | 'USD' | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          file_path: string
          thumbnail_path?: string | null
          file_size?: number | null
          duration_seconds?: number | null
          is_public?: boolean
          payment_type?: 'free' | 'paid'
          price_cents?: number | null
          currency?: 'EUR' | 'USD' | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          file_path?: string
          thumbnail_path?: string | null
          file_size?: number | null
          duration_seconds?: number | null
          is_public?: boolean
          payment_type?: 'free' | 'paid'
          price_cents?: number | null
          currency?: 'EUR' | 'USD' | null
          created_at?: string
        }
        Relationships: []
      }
      video_purchases: {
        Row: {
          id: string
          video_id: string
          buyer_id: string
          amount_cents: number
          currency: 'EUR' | 'USD'
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
          provider: string | null
          provider_payment_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          buyer_id: string
          amount_cents: number
          currency: 'EUR' | 'USD'
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
          provider?: string | null
          provider_payment_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          buyer_id?: string
          amount_cents?: number
          currency?: 'EUR' | 'USD'
          payment_status?: 'pending' | 'paid' | 'failed' | 'refunded'
          provider?: string | null
          provider_payment_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          platform_enabled: boolean
          payments_enabled: boolean
          maintenance_message: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          platform_enabled?: boolean
          payments_enabled?: boolean
          maintenance_message?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          platform_enabled?: boolean
          payments_enabled?: boolean
          maintenance_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}