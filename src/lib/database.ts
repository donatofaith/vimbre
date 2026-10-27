import type { Json } from './database.types'
import type { Database as GeneratedDatabase } from './database.types'

type Functions = GeneratedDatabase['public']['Functions']

type NullableArgs<
  T extends { Args: object },
  Keys extends keyof T['Args'],
> = Omit<T, 'Args'> & {
  Args: {
    [Key in keyof T['Args']]:
      | T['Args'][Key]
      | (Key extends Keys ? null : never)
  }
}

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Functions'> & {
    Functions: Omit<
      Functions,
      'manage_department' | 'manage_member' | 'work_notification_inbox' | 'work_notification_read' | 'chat_team' | 'chat_people' | 'chat_create' | 'chat_list' | 'chat_detail' | 'chat_send' | 'chat_read' | 'chat_inbox' | 'company_active_member_count' | 'team_activity_overview' | 'my_day_summary' | 'capture_list' | 'capture_detail' | 'capture_change' | 'manage_member_context'
    > & {
      myday_competition_settings: {Args:{p_mode?:string|null;p_visible?:boolean|null};Returns:Json}
      myday_streak_settings: {Args:{p_days?:number[]|null;p_from?:string|null;p_until?:string|null};Returns:Json}
      myday_skip_review: {Args:{p_operation?:string;p_task?:string|null;p_date?:string|null};Returns:Json}
      myday_social: {Args:{p_operation?:string;p_recipient?:string|null;p_body?:string};Returns:Json}
      myday_stars: {Args:Record<PropertyKey,never>;Returns:Json}
      myday_plan: {Args:{p_operation:string;p_data?:Json};Returns:Json}
      myday_edit: {Args:{p_id:string;p_data:Json};Returns:Json}
      myday_suite: {Args:{p_operation:string;p_id?:string|null;p_data?:Json};Returns:Json}
      handover_workspace: {Args:{p_operation:string;p_id?:string|null;p_data?:Json};Returns:Json}
      handover_shared: {Args:{p_token:string};Returns:Json}
      read_role_guide: {Args:{p_token:string|null};Returns:Json}
      role_workspace: {Args:{p_operation:string;p_role?:string|null;p_data?:Json};Returns:Json}
      console_customer_notices: {Args:{p_action:string;p_id?:string|null};Returns:Json}
      capture_notifications: {Args:{p_seen?:string|null};Returns:Json}
      capture_pipeline: {Args:{p_operation:string;p_id?:string|null;p_data?:Json};Returns:Json}
      myday_people: {Args:{p_query?:string;p_page?:number};Returns:Json}
      myday_task_history: {Args:{p_id:string};Returns:Json}
      myday_role_task: {Args:{p_record:string;p_date:string};Returns:string}
      myday_handover: {Args:{p_id:string;p_operation:string;p_data?:Json};Returns:string}
      myday_handovers: {Args:Record<PropertyKey,never>;Returns:Json}
      team_member_tasks: {Args:{p_owner:string;p_view:string;p_query:string;p_page:number;p_decision?:string|null};Returns:Json}
      myday_tasks: {Args:{p_filter:string;p_query:string;p_for:string;p_page:number;p_task?:string|null;p_decision?:string|null;p_source?:string;p_priority?:string};Returns:Json}
      myday_valid_recurrence: {Args:{p_date:string;p_rule:string};Returns:boolean}
      myday_preferences: {Args:{p_save?:Json};Returns:Json}
      myday_notes: {Args:{p_page:number};Returns:Json}
      myday_action: {Args:{p_id:string;p_operation:string;p_data:Json};Returns:string}
      myday_alerts: {Args:Record<PropertyKey,never>;Returns:Json}
      ai_allowance_summary: { Args: Record<PropertyKey, never>; Returns: Json }
      work_notification_inbox: { Args: {p_timezone: string; p_page: number}; Returns: Json }
      work_notification_read: { Args: {p_key: string; p_timezone: string}; Returns: boolean }
      chat_team: { Args: Record<PropertyKey, never>; Returns: string }
      chat_people: { Args: {p_search: string; p_page: number}; Returns: Json }
      chat_create: { Args: {p_kind: string; p_title: string; p_members: string[]}; Returns: string }
      chat_list: { Args: {p_page: number}; Returns: Json }
      chat_detail: { Args: {p_conversation: string; p_before: number | null; p_anchor: string | null}; Returns: Json }
      chat_send: { Args: {p_conversation: string; p_id: string; p_body: string; p_reply: string | null; p_mentions: string[]; p_record_path: string | null}; Returns: string }
      chat_read: { Args: {p_conversation: string; p_through: number}; Returns: undefined }
      chat_inbox: { Args: Record<PropertyKey, never>; Returns: Json }
      company_active_member_count: { Args: Record<PropertyKey, never>; Returns: number }
      team_activity_overview: { Args: { p_search: string; p_page: number; p_timezone: string; p_member: string | null }; Returns: Json }
      my_day_summary: { Args: Record<PropertyKey, never>; Returns: Json }

      capture_list: {
        Args: {
          p_page: number
          p_archived: boolean
        }
        Returns: Json
      }

      capture_detail: {
        Args: {
          p_id: string
        }
        Returns: Json
      }

      capture_change: {
        Args: {
          p_operation: string
          p_id: string
          p_capture: string | null
          p_data: Json
        }
        Returns: string
      }

      manage_department: NullableArgs<
        Functions['manage_department'],
        'p_manager'
      >

      manage_member_context: NullableArgs<Functions['manage_member_context'], 'p_department' | 'p_start'>
      manage_member: NullableArgs<
        Functions['manage_member'],
        'p_department'
      >
    }
  }
}

