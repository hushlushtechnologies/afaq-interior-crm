import { z } from 'zod';
import { ROLE_KEYS } from '@/features/access/catalog';

export const roleLookupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, 'Enter the employee email.')
      .email('Enter a valid email address.')
      .max(254, 'Keep the email within 254 characters.'),
  })
  .strict();

export const roleChangeSchema = roleLookupSchema
  .extend({
    roleKey: z.enum(ROLE_KEYS),
    operation: z.enum(['assign', 'revoke']),
  })
  .strict();

export const roleAccountSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().email(),
    roles: z.array(z.enum(ROLE_KEYS)),
  })
  .strict();

export type RoleLookupValues = z.infer<typeof roleLookupSchema>;

export type RoleChangeValues = z.infer<typeof roleChangeSchema>;

export type RoleAccount = z.infer<typeof roleAccountSchema>;
