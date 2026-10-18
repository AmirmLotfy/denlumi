import { z } from 'zod';
import { expectedHousehold } from './household';

const uuid=z.string().uuid();
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const intakeInput=expectedHousehold.extend({
 intake_schema_version:z.literal('1'),
 answers:z.record(z.string(),z.unknown()),
 unknowns:z.array(z.string().trim().min(1).max(120)).max(100).default([])
}).strict();
export const homeInput=expectedHousehold.extend({
 zones:z.array(z.object({key:z.string().trim().min(1).max(80),label:z.string().trim().min(1).max(120),arrangement_note:z.string().max(1500).nullable(),resources:z.array(z.object({key:z.string().trim().min(1).max(80),kind:z.enum(['water','food','litter','rest','retreat','enrichment','barrier','other']),label:z.string().trim().min(1).max(120),status:z.enum(['planned','reported_present','unknown','removed']),pet_access:z.array(z.object({pet_id:uuid,access_plan:z.enum(['exclusive','shared','separate_times','unknown'])}).strict()).max(100)}).strict()).max(100)}).strict()).max(100),
 responsibilities:z.array(z.object({profile_id:uuid,pet_id:uuid.nullable(),label:z.string().trim().min(1).max(160),status:z.enum(['planned','unknown','removed']),note:z.string().max(1000).nullable()}).strict()).max(100)
}).strict();
export const planDraftInput=expectedHousehold.extend({locale:z.literal('en')}).strict();
export const planReviewInput=expectedHousehold.extend({reviewed_digest:digest}).strict();
export const handoverAckInput=z.object({acknowledged_digest:digest}).strict();
export const membershipAcceptInput=z.object({adult_acknowledged:z.literal(true)}).strict();
