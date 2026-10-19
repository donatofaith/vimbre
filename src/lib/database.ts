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