import { z } from 'zod';
import { recoveryRequestSchema } from '@/features/auth/recovery-schemas';

export const verificationRequestSchema = recoveryRequestSchema;

export const emailCodeSchema = z.object({
  email: verificationRequestSchema.shape.email,

  token: z
    .string()
    .trim()
    .max(12, 'Enter the 6-digit verification code.')
    .regex(/^\d{6}$/, 'Enter the 6-digit verification code.'),
});

export type VerificationRequestValues = z.infer<typeof verificationRequestSchema>;

export type EmailCodeValues = z.infer<typeof emailCodeSchema>;
