import { z } from 'zod';

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.')
    .max(254, 'Keep the email address within 254 characters.'),

  password: z.string().min(1, 'Enter your password.').max(1024, 'The password is too long.'),
});

export type SignInValues = z.infer<typeof signInSchema>;
