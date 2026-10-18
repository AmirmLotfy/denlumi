import { z } from 'zod';
import { expectedHousehold } from './household';
const uuid=z.string().uuid(), hash=z.string().regex(/^[a-f0-9]{64}$/);
export const recordScope=z.object({case_id:uuid,pet_ids:z.array(uuid).min(1).max(100),source_ids:z.array(uuid).max(10000)}).strict();
export const recordPreviewInput=expectedHousehold.extend({household_id:uuid,case_id:uuid,purpose:z.enum(['export','share']),format:z.enum(['text','html']),recipient_address:z.string().trim().email().max(254).nullable(),expires_at:z.iso.datetime({offset:true})}).strict();
export const recordAuthorizeInput=expectedHousehold.extend({household_id:uuid,summary_id:uuid,reviewed_digest:hash,purpose:z.enum(['export','share']),format:z.enum(['text','html']),recipient_address:z.string().trim().email().max(254).nullable(),expires_at:z.iso.datetime({offset:true}),scope:recordScope,confirm_exact_content:z.literal(true)}).strict();
export const revokeShareInput=expectedHousehold.extend({household_id:uuid,grant_id:uuid}).strict();
export const archivePetInput=expectedHousehold.extend({household_id:uuid,pet_id:uuid,expected_pet_version:z.number().int().positive(),confirm_archive:z.literal(true)}).strict();
export const deletionInput=expectedHousehold.extend({household_id:uuid,confirm_household_deletion:z.literal(true)}).strict();
export const recordRequest=z.discriminatedUnion('action',[
 z.object({action:z.literal('preview'),input:recordPreviewInput}).strict(),
 z.object({action:z.literal('authorize'),input:recordAuthorizeInput}).strict(),
 z.object({action:z.literal('revoke'),input:revokeShareInput}).strict(),
 z.object({action:z.literal('archive'),input:archivePetInput}).strict(),
 z.object({action:z.literal('delete_request'),input:deletionInput}).strict(),
 z.object({action:z.literal('delete_prepare'),household_id:uuid}).strict(),
 z.object({action:z.literal('list'),household_id:uuid}).strict(),
 z.object({action:z.literal('download'),export_id:uuid}).strict(),
 z.object({action:z.literal('view_share'),grant_id:uuid}).strict(),
 z.object({action:z.literal('delete_status'),request_id:uuid}).strict(),
 z.object({action:z.literal('delete_process'),request_id:uuid}).strict(),
]);
