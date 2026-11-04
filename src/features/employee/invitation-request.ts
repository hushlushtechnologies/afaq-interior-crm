import { z } from 'zod';
import { employeeInvitationSchema } from '@/features/employee/invitation-schemas';

export const invitationRequestSchema = employeeInvitationSchema.extend({
  requestId: z.string().uuid(),
});

export const invitationResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('queued'),
      invitationId: z.string().uuid(),
      workEmail: z.string().email(),
    })
    .strict(),
  z
    .object({
      status: z.literal('already_pending'),
      invitationId: z.string().uuid(),
      workEmail: z.string().email(),
    })
    .strict(),
  z
    .object({
      status: z.literal('account_exists'),
      invitationId: z.null(),
      workEmail: z.string().email(),
    })
    .strict(),
]);

export type InvitationRequest = z.infer<typeof invitationRequestSchema>;

export type InvitationResult = z.infer<typeof invitationResultSchema>;

export type InvitationActionState =
  | {
      status: 'ok';
      result: InvitationResult;
      message: string;
    }
  | {
      status: 'invalid' | 'unauthenticated' | 'denied' | 'conflict' | 'error';
      message: string;
    };
