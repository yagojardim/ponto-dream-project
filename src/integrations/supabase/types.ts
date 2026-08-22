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
    PostgrestVersion: "14.15"
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
      client_signals: {
        Row: {
          archived_at: string | null
          author: string | null
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string | null
          item_title: string | null
          metadata: Json
          po_reply: string | null
          project_id: string
          read_by_po: boolean
          reply_read_by_client: boolean
          responsible_po: string | null
          row_version: number
          tenant_id: string
          type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          author?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_title?: string | null
          metadata?: Json
          po_reply?: string | null
          project_id: string
          read_by_po?: boolean
          reply_read_by_client?: boolean
          responsible_po?: string | null
          row_version?: number
          tenant_id: string
          type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          author?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string | null
          item_title?: string | null
          metadata?: Json
          po_reply?: string | null
          project_id?: string
          read_by_po?: boolean
          reply_read_by_client?: boolean
          responsible_po?: string | null
          row_version?: number
          tenant_id?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_signals_item_fk"
            columns: ["tenant_id", "item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_signals_po_fk"
            columns: ["tenant_id", "responsible_po"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_signals_project_fk"
            columns: ["tenant_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "client_signals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          archived_at: string | null
          author_id: string | null
          author_kind: string
          body: string
          created_at: string
          id: string
          metadata: Json
          row_version: number
          tenant_id: string
          updated_at: string
          visibility: string
          work_item_id: string
        }
        Insert: {
          archived_at?: string | null
          author_id?: string | null
          author_kind?: string
          body: string
          created_at?: string
          id?: string
          metadata?: Json
          row_version?: number
          tenant_id: string
          updated_at?: string
          visibility?: string
          work_item_id: string
        }
        Update: {
          archived_at?: string | null
          author_id?: string | null
          author_kind?: string
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          row_version?: number
          tenant_id?: string
          updated_at?: string
          visibility?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_assignments: {
        Row: {
          archived_at: string | null
          card_id: string
          card_title: string
          created_at: string
          created_by: string | null
          dashboard_key: string
          id: string
          metadata: Json
          position: number
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          card_id: string
          card_title: string
          created_at?: string
          created_by?: string | null
          dashboard_key: string
          id?: string
          metadata?: Json
          position?: number
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          card_id?: string
          card_title?: string
          created_at?: string
          created_by?: string | null
          dashboard_key?: string
          id?: string
          metadata?: Json
          position?: number
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_assignments_user_id_fk"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      dashboards: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number
          id: string
          key: string
          label: string
          question: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          key: string
          label: string
          question?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          key?: string
          label?: string
          question?: string | null
        }
        Relationships: []
      }
      dependencies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          relation_type: string
          source_id: string
          target_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          relation_type: string
          source_id: string
          target_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          relation_type?: string
          source_id?: string
          target_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      epics: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          metadata: Json
          name: string
          owner_id: string | null
          project_id: string
          quarter: string | null
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          metadata?: Json
          name: string
          owner_id?: string | null
          project_id: string
          quarter?: string | null
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          metadata?: Json
          name?: string
          owner_id?: string | null
          project_id?: string
          quarter?: string | null
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epics_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "epics_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "epics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          epic_id: string
          id: string
          metadata: Json
          name: string
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          epic_id: string
          id?: string
          metadata?: Json
          name: string
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          epic_id?: string
          id?: string
          metadata?: Json
          name?: string
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "features_epic_id_tenant_id_fkey"
            columns: ["epic_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "features_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          author_name: string | null
          created_at: string
          id: string
          message: string
          metadata: Json
          profile_id: string | null
          rating: number | null
          screen_label: string | null
          screen_url: string | null
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          profile_id?: string | null
          rating?: number | null
          screen_label?: string | null
          screen_url?: string | null
          status?: string
          tenant_id: string
          type?: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          profile_id?: string | null
          rating?: number | null
          screen_label?: string | null
          screen_url?: string | null
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string | null
          metadata: Json
          name: string
          role_id: string | null
          row_version: number
          squad_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          metadata?: Json
          name: string
          role_id?: string | null
          row_version?: number
          squad_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          metadata?: Json
          name?: string
          role_id?: string | null
          row_version?: number
          squad_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      item_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          field: string
          from_value: string | null
          id: string
          tenant_id: string
          to_value: string | null
          work_item_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          field?: string
          from_value?: string | null
          id?: string
          tenant_id: string
          to_value?: string | null
          work_item_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          field?: string
          from_value?: string | null
          id?: string
          tenant_id?: string
          to_value?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_status_history_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_activation_requests: {
        Row: {
          archived_at: string | null
          business_reason: string | null
          created_at: string
          created_by: string | null
          expected_use: string | null
          id: string
          metadata: Json
          module_id: string
          notes: string | null
          priority: string
          request_status: string
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          business_reason?: string | null
          created_at?: string
          created_by?: string | null
          expected_use?: string | null
          id?: string
          metadata?: Json
          module_id: string
          notes?: string | null
          priority?: string
          request_status?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          business_reason?: string | null
          created_at?: string
          created_by?: string | null
          expected_use?: string | null
          id?: string
          metadata?: Json
          module_id?: string
          notes?: string | null
          priority?: string
          request_status?: string
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_activation_requests_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_activation_requests_requested_by_fk"
            columns: ["tenant_id", "requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "module_activation_requests_reviewed_by_fk"
            columns: ["tenant_id", "reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "module_activation_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_entitlements: {
        Row: {
          created_by: string | null
          expires_at: string | null
          granted_at: string
          id: string
          metadata: Json
          module_id: string
          source: string
          status: string
          tenant_id: string
          trial_id: string | null
        }
        Insert: {
          created_by?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          module_id: string
          source: string
          status?: string
          tenant_id: string
          trial_id?: string | null
        }
        Update: {
          created_by?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          module_id?: string
          source?: string
          status?: string
          tenant_id?: string
          trial_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_entitlements_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_entitlements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_entitlements_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "module_trials"
            referencedColumns: ["id"]
          },
        ]
      }
      module_trials: {
        Row: {
          activated_by: string | null
          cancelled_at: string | null
          converted_at: string | null
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          module_id: string
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          activated_by?: string | null
          cancelled_at?: string | null
          converted_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          metadata?: Json
          module_id: string
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          activated_by?: string | null
          cancelled_at?: string | null
          converted_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
          module_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_trials_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_trials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          default_status: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          is_future: boolean
          is_premium: boolean
          is_preview: boolean
          key: string
          metadata: Json
          module_type: string | null
          name: string
          row_version: number
          trial_duration_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_status?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_future?: boolean
          is_premium?: boolean
          is_preview?: boolean
          key: string
          metadata?: Json
          module_type?: string | null
          name: string
          row_version?: number
          trial_duration_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          default_status?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          is_future?: boolean
          is_premium?: boolean
          is_preview?: boolean
          key?: string
          metadata?: Json
          module_type?: string | null
          name?: string
          row_version?: number
          trial_duration_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          archived_at: string | null
          body: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          read: boolean
          row_version: number
          tenant_id: string
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          read?: boolean
          row_version?: number
          tenant_id: string
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          archived_at?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          read?: boolean
          row_version?: number
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fk"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      password_reset_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          metadata: Json
          profile_id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          profile_id: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          profile_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_allowed: boolean
          permission_id: string
          profile_id: string
          reason: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_allowed: boolean
          permission_id: string
          profile_id: string
          reason?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_allowed?: boolean
          permission_id?: string
          profile_id?: string
          reason?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_note: string | null
          archived_at: string | null
          auth_user_id: string | null
          avatar_color: string | null
          avatar_initials: string | null
          can_create_projects: boolean
          can_handle_client_messages: boolean
          created_at: string
          created_by: string | null
          department: string | null
          email: string
          first_access_at: string | null
          id: string
          job_title: string | null
          last_access_at: string | null
          last_login_at: string | null
          locale: string
          manager_id: string | null
          metadata: Json
          name: string
          password_must_change: boolean
          phone: string | null
          primary_role: string | null
          reports_access: boolean
          row_version: number
          status: string
          tenant_id: string
          tenant_owner: boolean
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_note?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_color?: string | null
          avatar_initials?: string | null
          can_create_projects?: boolean
          can_handle_client_messages?: boolean
          created_at?: string
          created_by?: string | null
          department?: string | null
          email: string
          first_access_at?: string | null
          id?: string
          job_title?: string | null
          last_access_at?: string | null
          last_login_at?: string | null
          locale?: string
          manager_id?: string | null
          metadata?: Json
          name: string
          password_must_change?: boolean
          phone?: string | null
          primary_role?: string | null
          reports_access?: boolean
          row_version?: number
          status?: string
          tenant_id: string
          tenant_owner?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_note?: string | null
          archived_at?: string | null
          auth_user_id?: string | null
          avatar_color?: string | null
          avatar_initials?: string | null
          can_create_projects?: boolean
          can_handle_client_messages?: boolean
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string
          first_access_at?: string | null
          id?: string
          job_title?: string | null
          last_access_at?: string | null
          last_login_at?: string | null
          locale?: string
          manager_id?: string | null
          metadata?: Json
          name?: string
          password_must_change?: boolean
          phone?: string | null
          primary_role?: string | null
          reports_access?: boolean
          row_version?: number
          status?: string
          tenant_id?: string
          tenant_owner?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_client_responsibles: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          project_id: string
          project_role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id: string
          project_id: string
          project_role?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id?: string
          project_id?: string
          project_role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "project_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: string | null
          id: string
          project_id: string
          tenant_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          project_id: string
          tenant_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          project_id?: string
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string
          lead_id: string | null
          metadata: Json
          name: string
          period_end: string | null
          period_start: string | null
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          archived_at?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key: string
          lead_id?: string | null
          metadata?: Json
          name: string
          period_end?: string | null
          period_start?: string | null
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          archived_at?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string
          lead_id?: string | null
          metadata?: Json
          name?: string
          period_end?: string | null
          period_start?: string | null
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          notes: string | null
          project_id: string
          release_date: string | null
          row_version: number
          state: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          version: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          notes?: string | null
          project_id: string
          release_date?: string | null
          row_version?: number
          state?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          version: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          notes?: string | null
          project_id?: string
          release_date?: string | null
          row_version?: number
          state?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "releases_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "releases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_slugs: {
        Row: {
          created_at: string
          slug: string
        }
        Insert: {
          created_at?: string
          slug: string
        }
        Update: {
          created_at?: string
          slug?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          grant_mode: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          grant_mode?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          grant_mode?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_assignable: boolean
          key: string
          label: string
          tier: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_assignable?: boolean
          key: string
          label: string
          tier?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_assignable?: boolean
          key?: string
          label?: string
          tier?: number
        }
        Relationships: []
      }
      shared_project_items: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          project_id: string
          row_version: number
          shared_entity_id: string
          shared_entity_type: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          project_id: string
          row_version?: number
          shared_entity_id: string
          shared_entity_type: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          row_version?: number
          shared_entity_id?: string
          shared_entity_type?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_project_items_project_fk"
            columns: ["tenant_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "shared_project_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_items: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          sprint_id: string
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          sprint_id: string
          tenant_id: string
          work_item_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          sprint_id?: string
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sprint_items_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_scope_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          points_delta: number | null
          sprint_id: string
          tenant_id: string
          work_item_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          points_delta?: number | null
          sprint_id: string
          tenant_id: string
          work_item_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          points_delta?: number | null
          sprint_id?: string
          tenant_id?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_scope_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_scope_events_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_scope_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_scope_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          goal: string | null
          id: string
          metadata: Json
          name: string
          project_id: string
          row_version: number
          start_date: string | null
          state: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          velocity: number | null
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          metadata?: Json
          name: string
          project_id: string
          row_version?: number
          start_date?: string | null
          state?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          velocity?: number | null
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          goal?: string | null
          id?: string
          metadata?: Json
          name?: string
          project_id?: string
          row_version?: number
          start_date?: string | null
          state?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprints_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "sprints_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          profile_id: string
          squad_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id: string
          squad_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          profile_id?: string
          squad_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "squad_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "squads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_bug_environments: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      tenant_modules: {
        Row: {
          activation_status: string | null
          approved_at: string | null
          approved_by: string | null
          archived_at: string | null
          contract_status: string | null
          created_at: string
          created_by: string | null
          enabled_at: string | null
          id: string
          metadata: Json
          module_id: string
          requested_at: string | null
          requested_by: string | null
          row_version: number
          status: string
          suspended_at: string | null
          suspended_reason: string | null
          technical_health: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          activation_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          contract_status?: string | null
          created_at?: string
          created_by?: string | null
          enabled_at?: string | null
          id?: string
          metadata?: Json
          module_id: string
          requested_at?: string | null
          requested_by?: string | null
          row_version?: number
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          technical_health?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          activation_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          archived_at?: string | null
          contract_status?: string | null
          created_at?: string
          created_by?: string | null
          enabled_at?: string | null
          id?: string
          metadata?: Json
          module_id?: string
          requested_at?: string | null
          requested_by?: string | null
          row_version?: number
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          technical_health?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_approved_by_fk"
            columns: ["tenant_id", "approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_modules_requested_by_fk"
            columns: ["tenant_id", "requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          admin_master_defined_at: string | null
          admin_master_defined_by: string | null
          admin_master_defined_method: string | null
          admin_master_grace_days: number
          admin_master_grace_until: string | null
          admin_master_status: string
          archived_at: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          extra_storage_bytes: number
          id: string
          locale: string
          logo_url: string | null
          max_file_bytes: number
          max_files_per_project: number
          metadata: Json
          primary_color: string | null
          registrant_profile_id: string | null
          row_version: number
          storage_plan: string
          storage_quota_bytes: number
          tenant_id: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_master_defined_at?: string | null
          admin_master_defined_by?: string | null
          admin_master_defined_method?: string | null
          admin_master_grace_days?: number
          admin_master_grace_until?: string | null
          admin_master_status?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          extra_storage_bytes?: number
          id?: string
          locale?: string
          logo_url?: string | null
          max_file_bytes?: number
          max_files_per_project?: number
          metadata?: Json
          primary_color?: string | null
          registrant_profile_id?: string | null
          row_version?: number
          storage_plan?: string
          storage_quota_bytes?: number
          tenant_id: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_master_defined_at?: string | null
          admin_master_defined_by?: string | null
          admin_master_defined_method?: string | null
          admin_master_grace_days?: number
          admin_master_grace_until?: string | null
          admin_master_status?: string
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          extra_storage_bytes?: number
          id?: string
          locale?: string
          logo_url?: string | null
          max_file_bytes?: number
          max_files_per_project?: number
          metadata?: Json
          primary_color?: string | null
          registrant_profile_id?: string | null
          row_version?: number
          storage_plan?: string
          storage_quota_bytes?: number
          tenant_id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          document_encrypted: string | null
          document_hash: string | null
          document_last4: string | null
          document_verification_status: string
          id: string
          locale: string
          metadata: Json
          name: string
          row_version: number
          slug: string
          slug_status: string | null
          status: string
          timezone: string
          type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          document_encrypted?: string | null
          document_hash?: string | null
          document_last4?: string | null
          document_verification_status?: string
          id?: string
          locale?: string
          metadata?: Json
          name: string
          row_version?: number
          slug: string
          slug_status?: string | null
          status?: string
          timezone?: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          document_encrypted?: string | null
          document_hash?: string | null
          document_last4?: string | null
          document_verification_status?: string
          id?: string
          locale?: string
          metadata?: Json
          name?: string
          row_version?: number
          slug?: string
          slug_status?: string | null
          status?: string
          timezone?: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      timesheet_approvals: {
        Row: {
          approver_id: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          decision: string
          id: string
          metadata: Json
          reason: string | null
          row_version: number
          tenant_id: string
          timesheet_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approver_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          decision: string
          id?: string
          metadata?: Json
          reason?: string | null
          row_version?: number
          tenant_id: string
          timesheet_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approver_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          decision?: string
          id?: string
          metadata?: Json
          reason?: string | null
          row_version?: number
          tenant_id?: string
          timesheet_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_approvals_approver_fk"
            columns: ["tenant_id", "approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "timesheet_approvals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_approvals_timesheet_fk"
            columns: ["tenant_id", "timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approver_id: string | null
          archived_at: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          hours: number
          id: string
          metadata: Json
          month: string | null
          project_id: string
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
          work_item_id: string | null
        }
        Insert: {
          approver_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          hours?: number
          id?: string
          metadata?: Json
          month?: string | null
          project_id: string
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          work_item_id?: string | null
        }
        Update: {
          approver_id?: string | null
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          hours?: number
          id?: string
          metadata?: Json
          month?: string | null
          project_id?: string
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_approver_fk"
            columns: ["tenant_id", "approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "timesheets_item_fk"
            columns: ["tenant_id", "work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "timesheets_project_fk"
            columns: ["tenant_id", "project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "timesheets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_user_fk"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      user_dashboards: {
        Row: {
          created_at: string
          created_by: string | null
          dashboard_id: string
          id: string
          is_default: boolean
          metadata: Json
          profile_id: string
          row_version: number
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dashboard_id: string
          id?: string
          is_default?: boolean
          metadata?: Json
          profile_id: string
          row_version?: number
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dashboard_id?: string
          id?: string
          is_default?: boolean
          metadata?: Json
          profile_id?: string
          row_version?: number
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboards_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dashboards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_dashboards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_prefs: {
        Row: {
          created_at: string
          id: string
          pref_key: string
          row_version: number
          tenant_id: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          pref_key: string
          row_version?: number
          tenant_id: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          pref_key?: string
          row_version?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_primary: boolean
          profile_id: string
          role_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          profile_id: string
          role_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_primary?: boolean
          profile_id?: string
          role_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      watchers: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          tenant_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchers_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          tenant_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          tenant_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          tenant_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_labels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_labels_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          acceptance_status: string | null
          archived_at: string | null
          assignee_id: string | null
          blocked_reason: string | null
          board_column_id: string | null
          board_id: string | null
          business_value: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          epic_id: string | null
          feature_id: string | null
          id: string
          is_blocked: boolean
          key: string
          metadata: Json
          original_estimate: number | null
          parent_id: string | null
          position: number
          priority: string
          progress: number
          project_id: string
          release_id: string | null
          remaining_estimate: number | null
          reopened_at: string | null
          reporter_id: string | null
          resolution: string | null
          row_version: number
          severity: string | null
          sprint_id: string | null
          start_date: string | null
          status: string
          story_points: number | null
          tenant_id: string
          title: string
          type: string
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          acceptance_status?: string | null
          archived_at?: string | null
          assignee_id?: string | null
          blocked_reason?: string | null
          board_column_id?: string | null
          board_id?: string | null
          business_value?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          epic_id?: string | null
          feature_id?: string | null
          id?: string
          is_blocked?: boolean
          key: string
          metadata?: Json
          original_estimate?: number | null
          parent_id?: string | null
          position?: number
          priority?: string
          progress?: number
          project_id: string
          release_id?: string | null
          remaining_estimate?: number | null
          reopened_at?: string | null
          reporter_id?: string | null
          resolution?: string | null
          row_version?: number
          severity?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          story_points?: number | null
          tenant_id: string
          title: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          acceptance_status?: string | null
          archived_at?: string | null
          assignee_id?: string | null
          blocked_reason?: string | null
          board_column_id?: string | null
          board_id?: string | null
          business_value?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          epic_id?: string | null
          feature_id?: string | null
          id?: string
          is_blocked?: boolean
          key?: string
          metadata?: Json
          original_estimate?: number | null
          parent_id?: string | null
          position?: number
          priority?: string
          progress?: number
          project_id?: string
          release_id?: string | null
          remaining_estimate?: number | null
          reopened_at?: string | null
          reporter_id?: string | null
          resolution?: string | null
          row_version?: number
          severity?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          story_points?: number | null
          tenant_id?: string
          title?: string
          type?: string
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_board_column_id_tenant_id_fkey"
            columns: ["board_column_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_board_id_tenant_id_fkey"
            columns: ["board_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_epic_id_tenant_id_fkey"
            columns: ["epic_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "epics"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_feature_id_tenant_id_fkey"
            columns: ["feature_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_tenant_id_fkey"
            columns: ["project_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_release_id_tenant_id_fkey"
            columns: ["release_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_sprint_id_tenant_id_fkey"
            columns: ["sprint_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "work_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          archived_at: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          name: string
          row_version: number
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          archived_at?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name: string
          row_version?: number
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          archived_at?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          name?: string
          row_version?: number
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_project_storage: {
        Row: {
          file_count: number | null
          project_id: string | null
          tenant_id: string | null
          used_bytes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tenant_storage: {
        Row: {
          file_count: number | null
          tenant_id: string | null
          used_bytes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      __act_add_tenant_fk: {
        Args: {
          p_col: string
          p_constraint: string
          p_on_delete?: string
          p_table: string
          p_target: string
        }
        Returns: undefined
      }
      check_slug: { Args: { p_slug: string }; Returns: string }
      current_tenant_id: { Args: never; Returns: string }
      ensure_fk: {
        Args: {
          p_columns: string[]
          p_constraint: string
          p_on_delete?: string
          p_ref_columns: string[]
          p_ref_table: string
          p_table: string
        }
        Returns: undefined
      }
      normalize_slug: { Args: { p_slug: string }; Returns: string }
      unaccent_fallback: { Args: { p_text: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
