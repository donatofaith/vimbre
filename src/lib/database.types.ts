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
      role_items: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          details: string
          due_date: string | null
          id: string
          kind: string
          owner_id: string
          recurrence: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string
          due_date?: string | null
          id?: string
          kind: string
          owner_id: string
          recurrence?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string
          due_date?: string | null
          id?: string
          kind?: string
          owner_id?: string
          recurrence?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      customer_support: { Args: { p_action: string; p_payload?: Json }; Returns: Json }
      submit_customer_support: { Args: { p_body: string; p_category: string; p_subject: string }; Returns: Json }
      accept_invitation: { Args: { p_id: string }; Returns: undefined }
      cancel_invitation: { Args: { p_id: string }; Returns: undefined }
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

