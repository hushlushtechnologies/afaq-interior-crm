import { z } from 'zod';
import { ROLE_KEYS } from '@/features/access/catalog';

export const directoryQuerySchema = z
  .object({ search: z.string().trim().max(100), page: z.number().int().min(0).max(10000) })
  .strict();
export const directorySchema = z
  .object({
    rows: z
      .array(
        z
          .object({
            userId: z.string().uuid().nullable(),
            name: z.string(),
            email: z.string().email(),
            status: z.enum(['active', 'inactive', 'invited']),
            confirmed: z.boolean(),
            blocked: z.boolean(),
            roles: z.array(z.enum(ROLE_KEYS)),
            invitationStatus: z.string().nullable(),
          })
          .strict(),
      )
      .max(20),
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    canManage: z.boolean(),
  })
  .strict();
export const statusChangeSchema = z
  .object({
    requestId: z.string().uuid(),
    userId: z.string().uuid(),
    expected: z.enum(['active', 'inactive']),
    status: z.enum(['active', 'inactive']),
  })
  .strict()
  .refine((input) => input.expected !== input.status);
export type EmployeeDirectory = z.infer<typeof directorySchema>;
export type StatusChange = z.infer<typeof statusChangeSchema>;
export type DirectoryResult =
  { status: 'ok'; directory: EmployeeDirectory } | { status: 'error'; message: string };
export type StatusResult =
  | { status: 'ok'; replayed: boolean }
  | { status: 'error'; message: string }
  | { status: 'conflict'; message: string };
