/** Design contracts. UUIDs and request bodies still require runtime validation. */
export type UUID = string & { readonly __uuid: unique symbol };
export type Species = 'cat' | 'dog';
export type Pairing = 'cat_cat' | 'dog_dog' | 'cat_dog' | 'single_cat' | 'single_dog' | 'coordination';
export type SupportLevel = 'guided_preparation' | 'coordination_only' | 'clarification_required' | 'professional_required' | 'urgent_help';
export type SessionState = 'preflight' | 'active' | 'paused' | 'interrupted' | 'finished' | 'canceled';
export type Assertion = 'affirmed' | 'negated' | 'uncertain';
export interface StateStamp {
  householdId: UUID;
  safetyEpoch: number;
  homeVersion: number;
  planRevisionId: UUID;
  protocolVersionId: UUID;
  asOf: string;
}
export interface ObservationDraft {
  caseId: UUID;
  sessionId: UUID | null;
  actorPetId: UUID | null;
  targetPetId: UUID | null;
  rawReport: string;
  assertion: Assertion;
  observedAt: string | null;
  reportedAt: string;
  // Confirmation authority is supplied by the authenticated interaction,
  // never by an LLM-generated confirmed=true field.
}
export interface CurrentContext {
  stamp: StateStamp;
  supportLevel: SupportLevel;
  protocolStatus: 'draft' | 'in_review' | 'approved' | 'demo_only' | 'revoked' | 'expired';
  mode: 'demo' | 'live';
  openHoldIds: UUID[];
  requiredHandoverId: UUID | null;
  unknowns: string[];
  physicalStateVerified: false;
}
export type PreflightResult =
  | { allowed: true; reviewUrl: string; stamp: StateStamp; demoOnly: boolean }
  | { allowed: false; code: 'STALE_STATE' | 'GUIDANCE_PAUSED' | 'PROTOCOL_UNAVAILABLE' | 'SESSION_CONFLICT' | 'UNAUTHORIZED' | 'CLARIFICATION_REQUIRED'; message: string };
export interface IdempotentWrite {
  idempotencyKey: string;
  expectedSafetyEpoch: number;
}
export interface ShareApproval extends IdempotentWrite {
  previewId: UUID;
  payloadDigest: string;
  recipientDigest: string;
  expiresAt: string;
}
