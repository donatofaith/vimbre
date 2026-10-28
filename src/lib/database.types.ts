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
      actions: {
        Row: {
          company_id: string
          completed_at: string | null
          completion_note: string
          created_at: string
          decision_id: string | null
          deleted_at: string | null
          details: string
          due_date: string
          id: string
          owner_id: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          completion_note?: string
          created_at?: string
          decision_id?: string | null
          deleted_at?: string | null
          details?: string
          due_date: string
          id?: string
          owner_id: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          completion_note?: string
          created_at?: string
          decision_id?: string | null
          deleted_at?: string | null
          details?: string
          due_date?: string
          id?: string
          owner_id?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_decision_id_owner_id_company_id_fkey"
            columns: ["decision_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
          {
            foreignKeyName: "actions_owner_id_company_id_fkey"
            columns: ["owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          id: string
          record_id: string
          record_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          record_id: string
          record_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          record_id?: string
          record_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_forwarding_addresses: {
        Row: {
          address: string
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          owner_id: string
          verified_at: string | null
        }
        Insert: {
          address: string
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id: string
          verified_at?: string | null
        }
        Update: {
          address?: string
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capture_forwarding_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_forwarding_addresses_owner_id_company_id_fkey"
            columns: ["owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      capture_items: {
        Row: {
          action_id: string | null
          capture_id: string
          company_id: string
          contact_id: string | null
          created_at: string
          decision_id: string | null
          id: string
          kind: string
          origin: string
          owner_id: string
          payload: Json
          reviewed_at: string | null
          status: string
          version: number
        }
        Insert: {
          action_id?: string | null
          capture_id: string
          company_id: string
          contact_id?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          kind: string
          origin?: string
          owner_id: string
          payload: Json
          reviewed_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          action_id?: string | null
          capture_id?: string
          company_id?: string
          contact_id?: string | null
          created_at?: string
          decision_id?: string | null
          id?: string
          kind?: string
          origin?: string
          owner_id?: string
          payload?: Json
          reviewed_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "capture_items_action_id_owner_id_company_id_fkey"
            columns: ["action_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
          {
            foreignKeyName: "capture_items_capture_id_owner_id_company_id_fkey"
            columns: ["capture_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "captures"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
          {
            foreignKeyName: "capture_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capture_items_contact_id_owner_id_company_id_fkey"
            columns: ["contact_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "role_items"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
          {
            foreignKeyName: "capture_items_decision_id_owner_id_company_id_fkey"
            columns: ["decision_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
        ]
      }
      captures: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          owner_id: string
          source_date: string
          source_text: string
          source_type: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_id: string
          source_date: string
          source_text: string
          source_type: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          owner_id?: string
          source_date?: string
          source_text?: string
          source_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "captures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captures_owner_id_company_id_fkey"
            columns: ["owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          direct_key: string | null
          id: string
          is_team: boolean
          kind: string
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          direct_key?: string | null
          id?: string
          is_team?: boolean
          kind: string
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          direct_key?: string | null
          id?: string
          is_team?: boolean
          kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          company_id: string
          conversation_id: string
          joined_at: string
          last_read_seq: number
          user_id: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          joined_at?: string
          last_read_seq?: number
          user_id: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          joined_at?: string
          last_read_seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_conversation_id_company_id_fkey"
            columns: ["conversation_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          company_id: string
          conversation_id: string
          created_at: string
          id: string
          mentions: string[]
          record_path: string | null
          reply_to: string | null
          sender_id: string
          seq: number
        }
        Insert: {
          body: string
          company_id: string
          conversation_id: string
          created_at?: string
          id: string
          mentions?: string[]
          record_path?: string | null
          reply_to?: string | null
          sender_id: string
          seq?: never
        }
        Update: {
          body?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mentions?: string[]
          record_path?: string | null
          reply_to?: string | null
          sender_id?: string
          seq?: never
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_company_id_fkey"
            columns: ["conversation_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_conversation_id_fkey"
            columns: ["reply_to", "conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id", "conversation_id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_notifications: {
        Row: {
          company_id: string
          conversation_id: string
          created_at: string
          id: number
          mentioned: boolean
          message_id: string
          recipient_id: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          created_at?: string
          id?: never
          mentioned?: boolean
          message_id: string
          recipient_id: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          created_at?: string
          id?: never
          mentioned?: boolean
          message_id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_notifications_conversation_id_company_id_fkey"
            columns: ["conversation_id", "company_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "chat_notifications_message_id_conversation_id_fkey"
            columns: ["message_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id", "conversation_id"]
          },
          {
            foreignKeyName: "chat_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          contact_email: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          team_mode: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          team_mode?: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          team_mode?: string
          updated_at?: string
        }
        Relationships: []
      }
      decisions: {
        Row: {
          company_id: string
          created_at: string
          decided_by: string
          decided_on: string
          deleted_at: string | null
          id: string
          next_step: string
          owner_id: string
          reason: string
          related_task_url: string | null
          source_url: string | null
          status: string
          title: string
          updated_at: string
          workstream_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          decided_by: string
          decided_on: string
          deleted_at?: string | null
          id?: string
          next_step?: string
          owner_id: string
          reason: string
          related_task_url?: string | null
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
          workstream_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          decided_by?: string
          decided_on?: string
          deleted_at?: string | null
          id?: string
          next_step?: string
          owner_id?: string
          reason?: string
          related_task_url?: string | null
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          workstream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_owner_id_company_id_fkey"
            columns: ["owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "decisions_workstream_id_owner_id_company_id_fkey"
            columns: ["workstream_id", "owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "role_items"
            referencedColumns: ["id", "owner_id", "company_id"]
          },
        ]
      }
      departments: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          id: string
          manager_id: string | null
          name: string
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          id?: string
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_company_fkey"
            columns: ["manager_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      email_log: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          invitation_id: string
          recipient: string
          requested_by: string | null
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          invitation_id: string
          recipient: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          invitation_id?: string
          recipient?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          invited_user_id: string | null
          last_requested_at: string | null
          role: string
          role_description: string
          role_start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          last_requested_at?: string | null
          role: string
          role_description?: string
          role_start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          invited_user_id?: string | null
          last_requested_at?: string | null
          role?: string
          role_description?: string
          role_start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_department_id_company_id_fkey"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          company_id: string
          created_at: string
          department_id: string | null
          email: string
          full_name: string
          id: string
          role: string
          role_description: string
          role_start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          company_id: string
          created_at?: string
          department_id?: string | null
          email: string
          full_name: string
          id: string
          role?: string
          role_description?: string
          role_start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          company_id?: string
          created_at?: string
          department_id?: string | null
          email?: string
          full_name?: string
          id?: string
          role?: string
          role_description?: string
          role_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_company_id_fkey"
            columns: ["department_id", "company_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      responsibility_notes: {
        Row: {
          author_id: string
          body: string
          item_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string
          body: string
          item_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "role_items"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_suggestions: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          item_id: string
          original_details: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          item_id: string
          original_details: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          original_details?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_suggestions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_suggestions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "role_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_items: {
        Row: {
          backup_person_id: string | null
          company_id: string
          contact_context: string
          contact_details: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          details: string
          due_date: string | null
          file_path: string | null
          id: string
          kind: string
          next_step: string
          organisation: string
          owner_id: string
          recurrence: string | null
          title: string
          updated_at: string
          url: string | null
          work_status: string
        }
        Insert: {
          backup_person_id?: string | null
          company_id: string
          contact_context?: string
          contact_details?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string
          due_date?: string | null
          file_path?: string | null
          id?: string
          kind: string
          next_step?: string
          organisation?: string
          owner_id: string
          recurrence?: string | null
          title: string
          updated_at?: string
          url?: string | null
          work_status?: string
        }
        Update: {
          backup_person_id?: string | null
          company_id?: string
          contact_context?: string
          contact_details?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string
          due_date?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          next_step?: string
          organisation?: string
          owner_id?: string
          recurrence?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          work_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_backup_company_fk"
            columns: ["backup_person_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
          {
            foreignKeyName: "role_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_items_owner_id_company_id_fkey"
            columns: ["owner_id", "company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "company_id"]
          },
        ]
      }
      work_notification_reads: {
        Row: {
          notification_key: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_key: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_key?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      capture_workspace: {Args:{p_action:string;p_id?:string|null;p_data?:Json};Returns:Json}
      customer_support: { Args: { p_action: string; p_payload?: Json }; Returns: Json }
      accept_invitation: { Args: { p_id: string }; Returns: undefined }
      cancel_invitation: { Args: { p_id: string }; Returns: undefined }
      capture_change: {
        Args: {
          p_capture: string
          p_data: Json
          p_id: string
          p_operation: string
        }
        Returns: string
      }
      capture_detail: { Args: { p_id: string }; Returns: Json }
      capture_list: {
        Args: { p_archived: boolean; p_page: number }
        Returns: Json
      }
      chat_create: {
        Args: { p_kind: string; p_members: string[]; p_title: string }
        Returns: string
      }
      chat_detail: {
        Args: { p_anchor?: string; p_before?: number; p_conversation: string }
        Returns: Json
      }
      chat_inbox: { Args: never; Returns: Json }
      chat_list: { Args: { p_page?: number }; Returns: Json }
      chat_people: {
        Args: { p_page?: number; p_search?: string }
        Returns: Json
      }
      chat_read: {
        Args: { p_conversation: string; p_through: number }
        Returns: undefined
      }
      chat_send: {
        Args: {
          p_body: string
          p_conversation: string
          p_id: string
          p_mentions?: string[]
          p_record_path?: string
          p_reply?: string
        }
        Returns: string
      }
      chat_team: { Args: never; Returns: string }
      cover_duties_action: { Args: { p_operation: string; p_id?: string | null; p_data?: Json }; Returns: Json }
      handover_share_question: { Args: { p_token: string; p_body: string; p_email?: string }; Returns: Json }
      company_active_member_count: { Args: never; Returns: number }
      complete_invitation_delivery: {
        Args: { p_error_code?: string; p_id: string; p_status: string }
        Returns: undefined
      }
      log_action_view: { Args: { p_owner: string }; Returns: undefined }
      log_role_view: { Args: { p_owner: string }; Returns: undefined }
      manage_department: {
        Args: {
          p_archive?: boolean
          p_id?: string
          p_manager?: string
          p_name?: string
        }
        Returns: string
      }
      manage_member: {
        Args: {
          p_active: boolean
          p_department: string
          p_full_name: string
          p_id: string
          p_role: string
        }
        Returns: undefined
      }
      manage_member_context: {
        Args: {
          p_active: boolean
          p_department: string
          p_description: string
          p_full_name: string
          p_id: string
          p_role: string
          p_start: string
        }
        Returns: undefined
      }
      my_day_summary: { Args: never; Returns: Json }
      my_invitation: {
        Args: never
        Returns: {
          company_name: string
          department_name: string
          expires_at: string
          full_name: string
          invitation_id: string
          role: string
        }[]
      }
      prepare_invitation: {
        Args: {
          p_action: string
          p_department?: string
          p_email?: string
          p_full_name?: string
          p_id?: string
          p_role?: string
        }
        Returns: {
          email: string
          email_log_id: string
          full_name: string
          invitation_id: string
        }[]
      }
      prepare_invitation_context: {
        Args: {
          p_action: string
          p_department: string
          p_description: string
          p_email: string
          p_full_name: string
          p_id: string
          p_role: string
          p_start: string
        }
        Returns: {
          email: string
          email_log_id: string
          full_name: string
          invitation_id: string
        }[]
      }
      review_responsibility: {
        Args: { p_approve: boolean; p_id: string }
        Returns: undefined
      }
      suggest_responsibility: {
        Args: { p_body: string; p_item: string }
        Returns: string
      }
      team_activity_overview: {
        Args: {
          p_member?: string
          p_page?: number
          p_search?: string
          p_timezone?: string
        }
        Returns: Json
      }
      work_notification_inbox: {
        Args: { p_page?: number; p_timezone?: string }
        Returns: Json
      }
      work_notification_read: {
        Args: { p_key: string; p_timezone?: string }
        Returns: boolean
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

