import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          avatar_url: string | null
          kdf_salt: string
          two_factor_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>
      }
      projects: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          description: string | null
          settings: Record<string, unknown>
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["projects"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>
      }
      environments: {
        Row: {
          id: string
          project_id: string
          name: string
          display_name: string | null
          is_default: boolean
          secrets_version: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["environments"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["environments"]["Row"]>
      }
      vault_blobs: {
        Row: {
          id: string
          project_id: string
          environment_id: string
          key_id: string
          iv: string
          ciphertext: string
          auth_tag: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["vault_blobs"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["vault_blobs"]["Row"]>
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          project_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Record<string, unknown>
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: "owner" | "admin" | "developer" | "viewer"
          invited_by: string | null
          created_at: string
          accepted_at: string | null
        }
        Insert: Omit<Database["public"]["Tables"]["project_members"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["project_members"]["Row"]>
      }
    }
  }
}
