/**
 * Census Database Types (mirrored from census/db.ts for frontend use)
 */

export type EmailClassification =
  | "CONTRACT"
  | "DUST_PERMIT"
  | "SWPPP"
  | "ESTIMATE"
  | "INSURANCE"
  | "INVOICE"
  | "SCHEDULE"
  | "CHANGE_ORDER"
  | "INTERNAL"
  | "VENDOR"
  | "SPAM"
  | "UNKNOWN";

export type TaskType = "action_required" | "fyi" | "follow_up" | "waiting_on";

export type TaskPriority = "urgent" | "normal" | "low";

export type ClassificationMethod = "pattern" | "llm";

export type AccountType = "contractor" | "platform" | "internal";

export interface CensusAccount {
  id: number;
  domain: string;
  name: string;
  type: AccountType;
  contactCount: number;
  emailCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CensusProject {
  id: number;
  accountId: number | null;
  name: string;
  normalizedName: string | null;
  address: string | null;
  emailCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  mondayItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CensusEmail {
  id: number;
  messageId: string;
  mailboxId: number;
  conversationId: string | null;
  subject: string | null;
  fromEmail: string | null;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  receivedAt: string;
  hasAttachments: boolean;
  attachmentNames: string[];
  bodyPreview: string | null;
  webUrl: string | null;
  classification: EmailClassification | null;
  classificationConfidence: number | null;
  classificationMethod: ClassificationMethod | null;
  projectName: string | null;
  contractorName: string | null;
  mondayEstimateId: string | null;
  notionProjectId: string | null;
  accountId: number | null;
  projectId: number | null;
  bodyFull: string | null;
  bodyHtml: string | null;
  categories: string[];
  createdAt: string;
}

export interface CensusEstimate {
  id: number;
  mondayItemId: string;
  name: string;
  estimateNumber: string | null;
  contractor: string | null;
  groupId: string | null;
  groupTitle: string | null;
  mondayUrl: string | null;
  accountMondayId: string | null;
  accountDomain: string | null;
  bidStatus: string | null;
  bidValue: number | null;
  awardedValue: number | null;
  bidSource: string | null;
  awarded: boolean;
  dueDate: string | null;
  location: string | null;
  sharepointUrl: string | null;
  estimateStorageBucket: string | null;
  estimateStoragePath: string | null;
  estimateFileName: string | null;
  estimateSyncedAt: string | null;
  plansStoragePath: string | null;
  contractsStoragePath: string | null;
  noiStoragePath: string | null;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CensusAttachment {
  id: number;
  emailId: number;
  attachmentId: string;
  name: string;
  contentType: string | null;
  size: number | null;
  storageBucket: string | null;
  storagePath: string | null;
  extractedText: string | null;
  extractionStatus: "pending" | "success" | "failed" | "skipped";
  extractionError: string | null;
  extractedAt: string | null;
  createdAt: string;
}

export interface ClassificationStats {
  classification: EmailClassification | null;
  count: number;
}

export interface LinkSuggestion {
  projectId: number;
  reason: string;
  confidence: number;
  signalType?: "conversation" | "sender" | "domain" | "subject";
  project: CensusProject | null;
}
