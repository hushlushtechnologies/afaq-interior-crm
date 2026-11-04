import { z } from 'zod';

// Account creation and role assignment remain separate authorized operations.
// Never accept passwords, actor IDs, role grants, or redirect URLs from this input.
export const employeeInvitationSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Enter the employee name.')
      .max(120, 'Keep the employee name within 120 characters.')
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
        message: 'Enter the employee name without control characters.',
      }),
    workEmail: z
      .string()
      .trim()
      .min(1, 'Enter the employee work email.')
      .max(254, 'Keep the work email within 254 characters.')
      .email('Enter a valid work email address.')
      .transform((value) => value.toLowerCase()),
  })
  .strict();

export type EmployeeInvitationValues = z.infer<typeof employeeInvitationSchema>;
