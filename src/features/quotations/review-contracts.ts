import { z } from 'zod';
import {
  quotationCalculationSchema,
  quotationDocumentSchema,
  quotationRecordSchema,
} from './contracts';

const counter = z.number().int().min(1).max(2147483647);
export const reviewStatusSchema = z.enum(['pending', 'approved', 'rejected', 'changes_requested']);
export const reviewDecisionStatusSchema = z.enum(['approved', 'rejected', 'changes_requested']);
export const reviewDecisionSchema = z
  .object({
    requestId: z.uuid(),
    reviewId: z.uuid(),
    expectedRevision: counter,
    expectedSavedVersion: counter,
    decision: z.enum(['approve', 'reject', 'request_changes']),
    comments: z.string().trim().max(4000).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision !== 'approve' && (value.comments ?? '').length < 2)
      context.addIssue({
        code: 'custom',
        path: ['comments'],
        message: 'Meaningful feedback is required.',
      });
  });
export const reviewDecisionResultSchema = z
  .object({
    id: z.uuid(),
    reviewId: z.uuid(),
    revision: counter,
    savedVersion: counter,
    status: reviewDecisionStatusSchema,
    replayed: z.boolean(),
  })
  .strict();
export const reviewSubmissionSchema = z
  .object({
    requestId: z.uuid(),
    quotationId: z.uuid(),
    expectedRevision: counter,
    expectedVersion: counter,
    reviewerId: z.uuid(),
  })
  .strict();
export const reviewSubmissionResultSchema = z
  .object({
    id: z.uuid(),
    quotationId: z.uuid(),
    revision: counter,
    savedVersion: counter,
    status: z.literal('pending'),
    replayed: z.boolean(),
  })
  .strict();
export const quotationReviewSchema = z
  .object({
    id: z.uuid(),
    quotationId: z.uuid(),
    number: z.string(),
    revision: counter,
    savedVersion: counter,
    status: reviewStatusSchema,
    isCurrentRevision: z.boolean().optional(),
    isLatestSavedVersion: z.boolean().optional(),
    decision: z
      .object({
        id: z.uuid(),
        status: reviewDecisionStatusSchema,
        actorId: z.uuid(),
        comments: z.string().nullable(),
        decidedAt: z.iso.datetime({ offset: true }),
      })
      .strict()
      .nullable()
      .default(null),
    submittedBy: z.uuid(),
    reviewerId: z.uuid(),
    creatorId: z.uuid(),
    editorId: z.uuid(),
    submittedAt: z.iso.datetime({ offset: true }),
    snapshot: z
      .object({
        customer: quotationRecordSchema.shape.customer,
        document: quotationDocumentSchema,
        calculation: quotationCalculationSchema,
      })
      .strict(),
    evidence: z
      .object({
        requirements: z.array(
          z
            .object({
              id: z.uuid(),
              kind: z.enum(['requirements', 'room']),
              version: z.number().int().positive().safe(),
              data: z.record(z.string(), z.json()),
            })
            .strict(),
        ),
        images: z
          .array(
            z
              .object({
                conceptId: z.uuid(),
                conceptVersion: counter,
                title: z.string(),
                promptNotes: z.string().nullable(),
                roomId: z.uuid().nullable(),
                attachmentId: z.uuid(),
                filename: z.string(),
                mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
                bytes: z.number().int().min(1).max(10485760),
                sha256: z.string().regex(/^[a-f0-9]{64}$/),
              })
              .strict(),
          )
          .max(200),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === 'pending' && value.decision !== null) ||
      (value.status !== 'pending' && value.decision?.status !== value.status)
    )
      context.addIssue({
        code: 'custom',
        path: ['decision'],
        message: 'Review status and decision do not match.',
      });
  });
export type ReviewSubmissionResult = z.infer<typeof reviewSubmissionResultSchema>;
export type QuotationReview = z.infer<typeof quotationReviewSchema>;
export type ReviewDecisionResult = z.infer<typeof reviewDecisionResultSchema>;