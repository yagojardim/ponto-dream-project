export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acceptance_criteria: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_done: boolean
          position: number
          tenant_id: string
          text: string
          updated_at: string
          updated_by: string | null
          work_item_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_done?: boolean
          position?: number
          tenant_id: string
          text: string
          updated_at?: string
          updated_by?: string | null
          work_item_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_done?: boolean
          position?: number
          tenant_id?: string
          text?: string
          updated_at?: string
          updated_by?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_criteria_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acceptance_criteria_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      activation_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          metadata: Json
          profile_id: string
          purpose: string
          tenant_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          metadata?: Json
          profile_id: string
          purpose: string
          tenant_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
          profile_id?: string
          purpose?: string
          tenant_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_tokens_profile_fk"
            columns: ["tenant_id", "profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      approver_squads: {
        Row: {
          approver_id: string
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          row_version: number
          squad_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver_id: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          row_version?: number
          squad_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver_id?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          row_version?: number
          squad_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approver_squads_approver_fk"
            columns: ["tenant_id", "approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "approver_squads_squad_fk"
            columns: ["tenant_id", "squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "approver_squads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          archived_at: string | null
          checksum_sha256: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          metadata: Json
          mime_type: string | null
          name: string
          scan_status: string
          size_bytes: number | null
          storage_path: string | null
          tenant_id: string
          url: string
          visibility: string
          work_item_id: string
        }
        Insert: {
          archived_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          name: string
          scan_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          tenant_id: string
          url: string
          visibility?: string
          work_item_id: string
        }
        Update: {
          archived_at?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          metadata?: Json
          mime_type?: string | null
          name?: string
          scan_status?: string
          size_bytes?: number | null
          storage_path?: string | null
          tenant_id?: string
          url?: string
          visibility?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      board_column_statuses: {
        Row: {
          board_column_id: string
          created_at: string
          id: string
          status_key: string
          tenant_id: string
        }
        Insert: {
          board_column_id: string
          created_at?: string
          id?: string
          status_key: string
          tenant_id: string
        }
        Update: {
          board_column_id?: string
          created_at?: string
          id?: string
          status_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_column_statuses_board_column_id_fkey"
            columns: ["board_column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_column_statuses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          position: number
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
          wip_limit: number | null
        }
        Insert: {
          board_id: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          position?: number
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          wip_limit?: number | null
        }
        Update: {
          board_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          position?: number
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_tenant_id_fkey"
            columns: ["board_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "board_columns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          archived_at: string | null
          board_type: string
          created_at: string
          created_by: string | null
          description: string | null
          filter: Json
          id: string
          metadata: Json
          name: string
          project_id: string
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          board_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter?: Json
          id?: string
          metadata?: Json
          name: string
          project_id: string
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          board_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter?: Json
          id?: string
          metadata?: Json
          name?: string
          project_id?: string
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boards_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "boards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          archived_at: string | null
          attendees: Json
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          event_type: string
          external_id: string | null
          external_provider: string | null
          id: string
          location: string | null
          metadata: Json
          project_id: string | null
          sprint_id: string | null
          starts_at: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          archived_at?: string | null
          attendees?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          project_id?: string | null
          sprint_id?: string | null
          starts_at: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          archived_at?: string | null
          attendees?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          event_type?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          location?: string | null
          metadata?: Json
          project_id?: string | null
          sprint_id?: string | null
          starts_at?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_values: {
        Row: {
          catalog_id: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          key: string
          label: string
          metadata: Json
          row_version: number
          semantic_color: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          catalog_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key: string
          label: string
          metadata?: Json
          row_version?: number
          semantic_color?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          catalog_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          metadata?: Json
          row_version?: number
          semantic_color?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_values_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_values_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogs: {
        Row: {
          allows_tenant_override: boolean
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          allows_tenant_override?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          allows_tenant_override?: boolean
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      client_approvals: {
        Row: {
          archived_at: string | null
          client_user_id: string | null
          created_at: string
          created_by: string | null
          decided_at: string | null
          id: string
          metadata: Json
          project_id: string
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          work_item_id: string
        }
        Insert: {
          archived_at?: string | null
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          metadata?: Json
          project_id: string
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          work_item_id: string
        }
        Update: {
          archived_at?: string | null
          client_user_id?: string | null
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_approvals_item_fk"
            columns: ["tenant_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_approvals_project_fk"
            columns: ["tenant_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_approvals_user_fk"
            columns: ["tenant_id", "client_user_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          archived_at: string | null
          can_approve: boolean
          can_comment: boolean
          can_preview: boolean
          created_at: string
          created_by: string | null
          email: string
          id: string
          metadata: Json
          name: string
          password_must_change: boolean
          portal_role: string
          project_id: string
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          can_approve?: boolean
          can_comment?: boolean
          can_preview?: boolean
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          metadata?: Json
          name: string
          password_must_change?: boolean
          portal_role?: string
          project_id: string
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          can_approve?: boolean
          can_comment?: boolean
          can_preview?: boolean
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          metadata?: Json
          name?: string
          password_must_change?: boolean
          portal_role?: string
          project_id?: string
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_project_fk"
            columns: ["tenant_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_portal_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
