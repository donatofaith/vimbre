import type { Database as GeneratedDatabase } from './database.types'
// The generator omits nullable SQL function arguments. Preserve its output and
// explicitly model operations where null clears an assignment.
type Functions = GeneratedDatabase['public']['Functions']
type NullableArgs<T extends { Args: object }, Keys extends keyof T['Args']> = Omit<T, 'Args'> & {
  Args: { [Key in keyof T['Args']]: T['Args'][Key] | (Key extends Keys ? null : never) }
}
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedDatabase['public'], 'Functions'> & {
    Functions: Omit<Functions, 'manage_department' | 'manage_member'> & {
      manage_department: NullableArgs<Functions['manage_department'], 'p_manager'>
      manage_member: NullableArgs<Functions['manage_member'], 'p_department'>
    }
  }
}
