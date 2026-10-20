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
      'manage_department' | 'manage_member'
    > & {
      work_notification_inbox: { Args: {p_timezone: string; p_page: number}; Returns: Json }
      work_notification_read: { Args: {p_key: string; p_timezone: string}; Returns: boolean }
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

      manage_member: NullableArgs<
        Functions['manage_member'],
        'p_department'
      >
    }
  }
}
