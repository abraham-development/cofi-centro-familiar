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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adult_memberships: {
        Row: {
          created_at: string
          family_id: string
          id: string
          member_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          member_id: string
          role: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          member_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adult_memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adult_memberships_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: true
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_device_id: string | null
          actor_user_id: string | null
          created_at: string
          family_id: string
          id: number
          meta: Json
          object_id: string | null
          object_type: string
        }
        Insert: {
          action: string
          actor_device_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          family_id: string
          id?: never
          meta?: Json
          object_id?: string | null
          object_type: string
        }
        Update: {
          action?: string
          actor_device_id?: string | null
          actor_user_id?: string | null
          created_at?: string
          family_id?: string
          id?: never
          meta?: Json
          object_id?: string | null
          object_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          evening_time: string
          family_id: string
          id: string
          kind: string
          morning_time: string
          name: string
          notify_audience: string
          prep_minutes_before: number
          task_member_ids: string[]
          task_points: number
          task_title: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          evening_time?: string
          family_id: string
          id?: string
          kind: string
          morning_time?: string
          name: string
          notify_audience?: string
          prep_minutes_before?: number
          task_member_ids?: string[]
          task_points?: number
          task_title?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          evening_time?: string
          family_id?: string
          id?: string
          kind?: string
          morning_time?: string
          name?: string
          notify_audience?: string
          prep_minutes_before?: number
          task_member_ids?: string[]
          task_points?: number
          task_title?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_private_notes: {
        Row: {
          event_id: string
          family_id: string
          notes: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          event_id: string
          family_id: string
          notes: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          event_id?: string
          family_id?: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_private_notes_event_fk"
            columns: ["family_id", "event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          ends_at: string | null
          family_id: string
          id: string
          importance: string
          is_all_day: boolean
          is_exception: boolean
          last_command_id: string | null
          local_end_date: string
          local_start_date: string
          location: string | null
          occurrence_date: string | null
          reminder_offsets: number[]
          series_id: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
          whole_family: boolean
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          family_id: string
          id?: string
          importance?: string
          is_all_day?: boolean
          is_exception?: boolean
          last_command_id?: string | null
          local_end_date: string
          local_start_date: string
          location?: string | null
          occurrence_date?: string | null
          reminder_offsets?: number[]
          series_id?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          timezone: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
          whole_family?: boolean
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          family_id?: string
          id?: string
          importance?: string
          is_all_day?: boolean
          is_exception?: boolean
          last_command_id?: string | null
          local_end_date?: string
          local_start_date?: string
          location?: string | null
          occurrence_date?: string | null
          reminder_offsets?: number[]
          series_id?: string | null
          start_date?: string | null
          starts_at?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
          whole_family?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_category_fk"
            columns: ["family_id", "category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "calendar_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_series_fk"
            columns: ["family_id", "series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      event_automations: {
        Row: {
          accepted_at: string
          accepted_by: string | null
          event_id: string
          family_id: string
          rule_id: string
        }
        Insert: {
          accepted_at?: string
          accepted_by?: string | null
          event_id: string
          family_id: string
          rule_id: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string | null
          event_id?: string
          family_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_automations_event_fk"
            columns: ["family_id", "event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "event_automations_rule_fk"
            columns: ["family_id", "rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      event_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          family_id: string
          icon: string
          id: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          family_id: string
          icon?: string
          id?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          family_id?: string
          icon?: string
          id?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: string
          family_id: string
          member_id: string
        }
        Insert: {
          event_id: string
          family_id: string
          member_id: string
        }
        Update: {
          event_id?: string
          family_id?: string
          member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_fk"
            columns: ["family_id", "event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "event_participants_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      event_series: {
        Row: {
          by_weekday: number[] | null
          category_id: string | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          family_id: string
          freq: string
          id: string
          importance: string
          interval_count: number
          is_all_day: boolean
          location: string | null
          materialized_until: string | null
          missing_day_policy: string
          month_day: number | null
          reminder_offsets: number[]
          start_time: string | null
          starts_on: string
          status: string
          timezone: string
          title: string
          until_on: string | null
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
          whole_family: boolean
        }
        Insert: {
          by_weekday?: number[] | null
          category_id?: string | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          family_id: string
          freq: string
          id?: string
          importance?: string
          interval_count?: number
          is_all_day?: boolean
          location?: string | null
          materialized_until?: string | null
          missing_day_policy?: string
          month_day?: number | null
          reminder_offsets?: number[]
          start_time?: string | null
          starts_on: string
          status?: string
          timezone: string
          title: string
          until_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
          whole_family?: boolean
        }
        Update: {
          by_weekday?: number[] | null
          category_id?: string | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          family_id?: string
          freq?: string
          id?: string
          importance?: string
          interval_count?: number
          is_all_day?: boolean
          location?: string | null
          materialized_until?: string | null
          missing_day_policy?: string
          month_day?: number | null
          reminder_offsets?: number[]
          start_time?: string | null
          starts_on?: string
          status?: string
          timezone?: string
          title?: string
          until_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
          whole_family?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "event_series_category_fk"
            columns: ["family_id", "category_id"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "event_series_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      event_series_participants: {
        Row: {
          family_id: string
          member_id: string
          series_id: string
        }
        Insert: {
          family_id: string
          member_id: string
          series_id: string
        }
        Update: {
          family_id?: string
          member_id?: string
          series_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_series_participants_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "event_series_participants_series_fk"
            columns: ["family_id", "series_id"]
            isOneToOne: false
            referencedRelation: "event_series"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      families: {
        Row: {
          afternoon_ends: string
          command_id: string | null
          created_at: string
          created_by: string | null
          home_color: string
          id: string
          locale: string
          morning_ends: string
          name: string
          quiet_end: string
          quiet_start: string
          time_format: string
          timezone: string
          updated_at: string
          version: number
        }
        Insert: {
          afternoon_ends?: string
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          home_color?: string
          id?: string
          locale?: string
          morning_ends?: string
          name: string
          quiet_end?: string
          quiet_start?: string
          time_format?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          afternoon_ends?: string
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          home_color?: string
          id?: string
          locale?: string
          morning_ends?: string
          name?: string
          quiet_end?: string
          quiet_start?: string
          time_format?: string
          timezone?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      family_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          family_id: string
          id: string
          member_id: string | null
          revoked_at: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          family_id: string
          id?: string
          member_id?: string | null
          revoked_at?: string | null
          role?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          member_id?: string | null
          revoked_at?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_invitations_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      family_members: {
        Row: {
          archived_at: string | null
          avatar_emoji: string | null
          child_accent_color: string | null
          child_avatar_key: string | null
          color: string
          created_at: string
          display_name: string
          family_id: string
          id: string
          initials: string
          kind: string
          sort_order: number
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          avatar_emoji?: string | null
          child_accent_color?: string | null
          child_avatar_key?: string | null
          color: string
          created_at?: string
          display_name: string
          family_id: string
          id?: string
          initials: string
          kind: string
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          avatar_emoji?: string | null
          child_accent_color?: string | null
          child_avatar_key?: string | null
          color?: string
          created_at?: string
          display_name?: string
          family_id?: string
          id?: string
          initials?: string
          kind?: string
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      member_point_accounts: {
        Row: {
          balance: number
          family_id: string
          member_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          family_id: string
          member_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          family_id?: string
          member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_point_accounts_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: true
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          channel: string
          claimed_at: string | null
          created_at: string
          family_id: string
          id: string
          last_error: string | null
          last_status_code: number | null
          next_attempt_at: string | null
          not_before: string | null
          notification_id: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          channel?: string
          claimed_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_attempt_at?: string | null
          not_before?: string | null
          notification_id: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          channel?: string
          claimed_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          last_error?: string | null
          last_status_code?: number | null
          next_attempt_at?: string | null
          not_before?: string | null
          notification_id?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_receipts: {
        Row: {
          acknowledged_at: string | null
          family_id: string
          notification_id: string
          read_at: string | null
          recipient: string
        }
        Insert: {
          acknowledged_at?: string | null
          family_id: string
          notification_id: string
          read_at?: string | null
          recipient: string
        }
        Update: {
          acknowledged_at?: string | null
          family_id?: string
          notification_id?: string
          read_at?: string | null
          recipient?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_receipts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_receipts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          dedupe_key: string
          expires_at: string | null
          family_id: string
          id: string
          importance: string
          job_id: string | null
          kind: string
          member_id: string | null
          source_id: string | null
          source_type: string | null
          title: string
        }
        Insert: {
          audience: string
          body?: string | null
          created_at?: string
          dedupe_key: string
          expires_at?: string | null
          family_id: string
          id?: string
          importance?: string
          job_id?: string | null
          kind: string
          member_id?: string | null
          source_id?: string | null
          source_type?: string | null
          title: string
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          dedupe_key?: string
          expires_at?: string | null
          family_id?: string
          id?: string
          importance?: string
          job_id?: string | null
          kind?: string
          member_id?: string | null
          source_id?: string | null
          source_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      paired_devices: {
        Row: {
          approved_by: string | null
          auth_user_id: string | null
          created_at: string
          family_id: string
          id: string
          last_seen_at: string | null
          member_id: string | null
          name: string
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          version: number
        }
        Insert: {
          approved_by?: string | null
          auth_user_id?: string | null
          created_at?: string
          family_id: string
          id?: string
          last_seen_at?: string | null
          member_id?: string | null
          name: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope: string
          version?: number
        }
        Update: {
          approved_by?: string | null
          auth_user_id?: string | null
          created_at?: string
          family_id?: string
          id?: string
          last_seen_at?: string | null
          member_id?: string | null
          name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "paired_devices_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paired_devices_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          actor_user_id: string | null
          amount: number
          created_at: string
          family_id: string
          id: number
          idempotency_key: string
          kind: string
          member_id: string
          reason: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          created_at?: string
          family_id: string
          id?: never
          idempotency_key: string
          kind: string
          member_id: string
          reason?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          created_at?: string
          family_id?: string
          id?: never
          idempotency_key?: string
          kind?: string
          member_id?: string
          reason?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_id: string | null
          endpoint: string
          failure_count: number
          family_id: string
          id: string
          last_success_at: string | null
          owner_user_id: string
          p256dh: string
          revoked_at: string | null
          user_agent: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_id?: string | null
          endpoint: string
          failure_count?: number
          family_id: string
          id?: string
          last_success_at?: string | null
          owner_user_id: string
          p256dh: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_id?: string | null
          endpoint?: string
          failure_count?: number
          family_id?: string
          id?: string
          last_success_at?: string | null
          owner_user_id?: string
          p256dh?: string
          revoked_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_device_fk"
            columns: ["family_id", "device_id"]
            isOneToOne: false
            referencedRelation: "paired_devices"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "push_subscriptions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_jobs: {
        Row: {
          attempts: number
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          due_at: string
          family_id: string
          id: string
          job_key: string
          kind: string
          last_error: string | null
          next_attempt_at: string | null
          offset_minutes: number | null
          relevant_until: string
          rule_id: string | null
          source_id: string
          source_type: string
          source_version: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at: string
          family_id: string
          id?: string
          job_key: string
          kind: string
          last_error?: string | null
          next_attempt_at?: string | null
          offset_minutes?: number | null
          relevant_until: string
          rule_id?: string | null
          source_id: string
          source_type: string
          source_version: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_at?: string
          family_id?: string
          id?: string
          job_key?: string
          kind?: string
          last_error?: string | null
          next_attempt_at?: string | null
          offset_minutes?: number | null
          relevant_until?: string
          rule_id?: string | null
          source_id?: string
          source_type?: string
          source_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_jobs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_members: {
        Row: {
          family_id: string
          member_id: string
          reward_id: string
        }
        Insert: {
          family_id: string
          member_id: string
          reward_id: string
        }
        Update: {
          family_id?: string
          member_id?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_members_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "reward_members_reward_fk"
            columns: ["family_id", "reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          cancelled_at: string | null
          command_id: string | null
          cost: number
          decided_at: string | null
          decided_by: string | null
          delivered_at: string | null
          family_id: string
          id: string
          member_id: string
          note: string | null
          requested_at: string
          requested_by: string | null
          reward_id: string
          reward_title: string
          status: string
          version: number
        }
        Insert: {
          cancelled_at?: string | null
          command_id?: string | null
          cost: number
          decided_at?: string | null
          decided_by?: string | null
          delivered_at?: string | null
          family_id: string
          id?: string
          member_id: string
          note?: string | null
          requested_at?: string
          requested_by?: string | null
          reward_id: string
          reward_title: string
          status?: string
          version?: number
        }
        Update: {
          cancelled_at?: string | null
          command_id?: string | null
          cost?: number
          decided_at?: string | null
          decided_by?: string | null
          delivered_at?: string | null
          family_id?: string
          id?: string
          member_id?: string
          note?: string | null
          requested_at?: string
          requested_by?: string | null
          reward_id?: string
          reward_title?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_fk"
            columns: ["family_id", "reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      rewards: {
        Row: {
          archived_at: string | null
          command_id: string | null
          conditions: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          family_id: string
          id: string
          is_available: boolean
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          command_id?: string | null
          conditions?: string | null
          cost: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_id: string
          id?: string
          is_available?: boolean
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          command_id?: string | null
          conditions?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          family_id?: string
          id?: string
          is_available?: boolean
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rewards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      task_occurrences: {
        Row: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        Insert: {
          assignee_member_id?: string | null
          command_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_date?: string | null
          due_time?: string | null
          family_id: string
          generated_key?: string | null
          id?: string
          is_exception?: boolean
          kind: string
          last_command_id?: string | null
          notes?: string | null
          points?: number
          priority?: string
          requires_review?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_event_id?: string | null
          source_rule_id?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_late?: boolean | null
          template_id?: string | null
          timezone: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          assignee_member_id?: string | null
          command_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_date?: string | null
          due_time?: string | null
          family_id?: string
          generated_key?: string | null
          id?: string
          is_exception?: boolean
          kind?: string
          last_command_id?: string | null
          notes?: string | null
          points?: number
          priority?: string
          requires_review?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_event_id?: string | null
          source_rule_id?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_late?: boolean | null
          template_id?: string | null
          timezone?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_occurrences_assignee_fk"
            columns: ["family_id", "assignee_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "task_occurrences_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_occurrences_template_fk"
            columns: ["family_id", "template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      task_reviews: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          family_id: string
          id: string
          note: string | null
          points_delta: number
          task_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          family_id: string
          id?: string
          note?: string | null
          points_delta?: number
          task_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          family_id?: string
          id?: string
          note?: string | null
          points_delta?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reviews_task_fk"
            columns: ["family_id", "task_id"]
            isOneToOne: false
            referencedRelation: "task_occurrences"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      task_template_assignees: {
        Row: {
          family_id: string
          member_id: string
          template_id: string
        }
        Insert: {
          family_id: string
          member_id: string
          template_id: string
        }
        Update: {
          family_id?: string
          member_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_template_assignees_member_fk"
            columns: ["family_id", "member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["family_id", "id"]
          },
          {
            foreignKeyName: "task_template_assignees_template_fk"
            columns: ["family_id", "template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
            referencedColumns: ["family_id", "id"]
          },
        ]
      }
      task_templates: {
        Row: {
          by_weekday: number[] | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_time: string | null
          family_id: string
          freq: string
          id: string
          interval_count: number
          kind: string
          materialized_until: string | null
          missing_day_policy: string
          month_day: number | null
          points: number
          requires_review: boolean
          starts_on: string
          status: string
          timezone: string
          title: string
          until_on: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          by_weekday?: number[] | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_time?: string | null
          family_id: string
          freq: string
          id?: string
          interval_count?: number
          kind: string
          materialized_until?: string | null
          missing_day_policy?: string
          month_day?: number | null
          points?: number
          requires_review?: boolean
          starts_on: string
          status?: string
          timezone: string
          title: string
          until_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          by_weekday?: number[] | null
          command_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_time?: string | null
          family_id?: string
          freq?: string
          id?: string
          interval_count?: number
          kind?: string
          materialized_until?: string | null
          missing_day_policy?: string
          month_day?: number | null
          points?: number
          requires_review?: boolean
          starts_on?: string
          status?: string
          timezone?: string
          title?: string
          until_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: {
        Args: { p_color?: string; p_display_name?: string; p_token: string }
        Returns: string
      }
      acknowledge_notification: {
        Args: { p_notification_id: string }
        Returns: undefined
      }
      adjust_points: {
        Args: {
          p_amount: number
          p_command_id: string
          p_family_id: string
          p_member_id: string
          p_reason: string
        }
        Returns: undefined
      }
      adjust_task: {
        Args: {
          p_action: string
          p_command_id: string
          p_reason: string
          p_task_id: string
        }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_device_pairing: {
        Args: {
          p_code: string
          p_family_id: string
          p_member_id: string
          p_name: string
          p_scope: string
        }
        Returns: {
          device_id: string
          error_code: string
          ok: boolean
        }[]
      }
      archive_reward: {
        Args: { p_archived: boolean; p_reward_id: string }
        Returns: undefined
      }
      cancel_event: {
        Args: {
          p_command_id: string
          p_event_id: string
          p_expected_version: number
          p_reason?: string
        }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          ends_at: string | null
          family_id: string
          id: string
          importance: string
          is_all_day: boolean
          is_exception: boolean
          last_command_id: string | null
          local_end_date: string
          local_start_date: string
          location: string | null
          occurrence_date: string | null
          reminder_offsets: number[]
          series_id: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
          whole_family: boolean
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_push_deliveries: {
        Args: { p_batch?: number }
        Returns: {
          auth_key: string
          body: string
          delivery_id: string
          endpoint: string
          p256dh: string
          tag: string
          title: string
          url: string
        }[]
      }
      complete_push_delivery: {
        Args: { p_delivery_id: string; p_error: string; p_status_code: number }
        Returns: undefined
      }
      create_event: {
        Args: {
          p_category_id: string
          p_command_id: string
          p_description: string
          p_end_date: string
          p_ends_at: string
          p_family_id: string
          p_importance: string
          p_is_all_day: boolean
          p_location: string
          p_participant_ids: string[]
          p_private_notes?: string
          p_reminder_offsets?: number[]
          p_rule_ids?: string[]
          p_start_date: string
          p_starts_at: string
          p_title: string
          p_visibility: string
          p_whole_family: boolean
        }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          ends_at: string | null
          family_id: string
          id: string
          importance: string
          is_all_day: boolean
          is_exception: boolean
          last_command_id: string | null
          local_end_date: string
          local_start_date: string
          location: string | null
          occurrence_date: string | null
          reminder_offsets: number[]
          series_id: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
          whole_family: boolean
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_event_series: {
        Args: {
          p_by_weekday: number[]
          p_category_id: string
          p_command_id: string
          p_description: string
          p_duration_minutes: number
          p_family_id: string
          p_freq: string
          p_importance: string
          p_interval: number
          p_is_all_day: boolean
          p_location: string
          p_missing: string
          p_month_day: number
          p_participant_ids: string[]
          p_start_time: string
          p_starts_on: string
          p_title: string
          p_until: string
          p_visibility: string
          p_whole_family: boolean
        }
        Returns: string
      }
      create_family: {
        Args: {
          p_command_id: string
          p_name: string
          p_owner_color: string
          p_owner_display_name: string
          p_timezone: string
        }
        Returns: string
      }
      create_household_task: {
        Args: {
          p_assignee_member_id: string
          p_command_id: string
          p_due_date: string
          p_due_time: string
          p_family_id: string
          p_notes: string
          p_priority: string
          p_title: string
          p_visibility: string
        }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invitation: {
        Args: {
          p_email: string
          p_family_id: string
          p_member_id?: string
          p_role?: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      decide_redemption: {
        Args: { p_action: string; p_note: string; p_redemption_id: string }
        Returns: {
          cancelled_at: string | null
          command_id: string | null
          cost: number
          decided_at: string | null
          decided_by: string | null
          delivered_at: string | null
          family_id: string
          id: string
          member_id: string
          note: string | null
          requested_at: string
          requested_by: string | null
          reward_id: string
          reward_title: string
          status: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "reward_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_push_subscription: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      device_heartbeat: { Args: never; Returns: undefined }
      end_event_series: {
        Args: { p_cancel_future: boolean; p_from: string; p_series_id: string }
        Returns: undefined
      }
      get_device_status: {
        Args: never
        Returns: {
          device_id: string
          device_name: string
          expires_at: string
          family_id: string
          family_name: string
          member_id: string
          scope: string
          status: string
        }[]
      }
      get_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          family_name: string
          invited_email: string
          role: string
          status: string
        }[]
      }
      reminders_health: {
        Args: { p_family_id: string }
        Returns: {
          failed_7d: number
          last_completed_at: string
          overdue_pending: number
          push_failed_7d: number
          push_sent_7d: number
          subscriptions: number
        }[]
      }
      request_device_pairing: {
        Args: never
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      request_redemption: {
        Args: { p_command_id: string; p_member_id: string; p_reward_id: string }
        Returns: {
          cancelled_at: string | null
          command_id: string | null
          cost: number
          decided_at: string | null
          decided_by: string | null
          delivered_at: string | null
          family_id: string
          id: string
          member_id: string
          note: string | null
          requested_at: string
          requested_by: string | null
          reward_id: string
          reward_title: string
          status: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "reward_redemptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_task: {
        Args: {
          p_command_id: string
          p_decision: string
          p_expected_version: number
          p_note: string
          p_task_id: string
        }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      save_automation_rule: {
        Args: {
          p_enabled: boolean
          p_evening_time: string
          p_family_id: string
          p_kind: string
          p_morning_time: string
          p_name: string
          p_notify_audience: string
          p_prep_minutes_before: number
          p_rule_id: string
          p_task_member_ids: string[]
          p_task_points: number
          p_task_title: string
        }
        Returns: string
      }
      save_child_appearance: {
        Args: { p_accent_color: string; p_avatar_key: string }
        Returns: {
          accent_color: string
          avatar_key: string
        }[]
      }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_family_id: string
          p_p256dh: string
          p_user_agent: string
        }
        Returns: string
      }
      save_reward: {
        Args: {
          p_command_id: string
          p_conditions: string
          p_cost: number
          p_description: string
          p_family_id: string
          p_is_available: boolean
          p_member_ids: string[]
          p_reward_id: string
          p_title: string
        }
        Returns: string
      }
      save_task_template: {
        Args: {
          p_assignee_ids: string[]
          p_by_weekday: number[]
          p_command_id: string
          p_description: string
          p_due_time: string
          p_expected_version: number
          p_family_id: string
          p_freq: string
          p_interval: number
          p_kind: string
          p_missing: string
          p_month_day: number
          p_points: number
          p_requires_review: boolean
          p_starts_on: string
          p_template_id: string
          p_title: string
          p_until: string
        }
        Returns: string
      }
      server_now: { Args: never; Returns: string }
      set_household_task_status: {
        Args: { p_command_id: string; p_status: string; p_task_id: string }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_task_template_status: {
        Args: { p_status: string; p_template_id: string }
        Returns: undefined
      }
      split_event_series: {
        Args: {
          p_by_weekday: number[]
          p_category_id: string
          p_command_id: string
          p_description: string
          p_duration_minutes: number
          p_freq: string
          p_from: string
          p_importance: string
          p_interval: number
          p_is_all_day: boolean
          p_location: string
          p_missing: string
          p_month_day: number
          p_participant_ids: string[]
          p_series_id: string
          p_start_time: string
          p_title: string
          p_until: string
          p_visibility: string
          p_whole_family: boolean
        }
        Returns: string
      }
      submit_task: {
        Args: { p_command_id: string; p_task_id: string }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_adult_membership: {
        Args: { p_membership_id: string; p_remove?: boolean; p_role?: string }
        Returns: undefined
      }
      update_device: {
        Args: { p_device_id: string; p_name: string; p_revoke: boolean }
        Returns: undefined
      }
      update_event: {
        Args: {
          p_category_id: string
          p_command_id: string
          p_description: string
          p_end_date: string
          p_ends_at: string
          p_event_id: string
          p_expected_version: number
          p_importance: string
          p_is_all_day: boolean
          p_location: string
          p_participant_ids: string[]
          p_private_notes?: string
          p_reminder_offsets?: number[]
          p_rule_ids?: string[]
          p_start_date: string
          p_starts_at: string
          p_title: string
          p_visibility: string
          p_whole_family: boolean
        }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          command_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          ends_at: string | null
          family_id: string
          id: string
          importance: string
          is_all_day: boolean
          is_exception: boolean
          last_command_id: string | null
          local_end_date: string
          local_start_date: string
          location: string | null
          occurrence_date: string | null
          reminder_offsets: number[]
          series_id: string | null
          start_date: string | null
          starts_at: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
          whole_family: boolean
        }
        SetofOptions: {
          from: "*"
          to: "calendar_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_household_task: {
        Args: {
          p_assignee_member_id: string
          p_command_id: string
          p_due_date: string
          p_due_time: string
          p_expected_version: number
          p_notes: string
          p_priority: string
          p_task_id: string
          p_title: string
          p_visibility: string
        }
        Returns: {
          assignee_member_id: string | null
          command_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_date: string | null
          due_time: string | null
          family_id: string
          generated_key: string | null
          id: string
          is_exception: boolean
          kind: string
          last_command_id: string | null
          notes: string | null
          points: number
          priority: string
          requires_review: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_event_id: string | null
          source_rule_id: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          submitted_late: boolean | null
          template_id: string | null
          timezone: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        SetofOptions: {
          from: "*"
          to: "task_occurrences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
