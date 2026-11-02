import { z } from 'zod';

export const recoveryRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.')
    .max(254, 'Keep the email address within 254 characters.'),
});

export const emailLinkSchema = z.object({
  tokenHash: z
    .string()
    .min(16)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/),

  type: z.enum(['recovery', 'email']),
});

const newPasswordSchema = z
  .string()
  .max(72, 'Choose a shorter password.')
  .refine((value) => Array.from(value).length >= 12, 'Use at least 12 characters.')
  .refine((value) => value.trim().length > 0, 'Choose a password containing more than spaces.')
  .refine((value) => new TextEncoder().encode(value).length <= 72, 'Choose a shorter password.');

export const passwordUpdateSchema = z
  .object({
    password: newPasswordSchema,

    confirmPassword: z
      .string()
      .min(1, 'Confirm your new password.')
      .max(72, 'Choose a shorter password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RecoveryRequestValues = z.infer<typeof recoveryRequestSchema>;

export type EmailLinkValues = z.infer<typeof emailLinkSchema>;

export type PasswordUpdateValues = z.infer<typeof passwordUpdateSchema>;
