// ---------------------------------------------------------------------------
// Type definitions for the AI Evidence Intake layer.
// These types govern the flow from document upload → AI extraction → human
// review → accepted claims → existing validation engine.
// ---------------------------------------------------------------------------

import type { DFCode } from './types'

export type AIClaimType = 'Explicit' | 'Inferred' | 'Negative' | 'Absent'
export type EvidenceQuality = 'High' | 'Medium' | 'Low' | 'N/A'
export type ClaimReviewStatus = 'Pending' | 'Accepted' | 'Rejected'
export type ContradictionSeverity = 'High' | 'Medium' | 'Low'

export interface UploadedDocument {
  documentId: string
  supplierId: string
  documentName: string
  documentType: string
  pageCount: number
  fileSizeKB: number
  uploadedAt: string // ISO timestamp
  textExtractable: boolean
}

export interface DocumentClassification {
  documentId: string
  expectedType: string
  coveredDFs: DFCode[]
  coveredFields: string[]
}

export interface AIClaim {
  claimId: string
  supplierId: string
  documentId: string
  documentName: string
  documentType: string
  claimType: AIClaimType
  claimText: string
  claimValue: string
  unit: string | null
  sourcePage: number | null
  directQuote: string
  mappedDecisionFactor: string // e.g. "DF1"
  mappedLeafFactor: string    // e.g. "LF1.1"
  backendField: string        // canonical field name
  extractionConfidence: number // 0..1
  evidenceQuality: EvidenceQuality
  reviewStatus: ClaimReviewStatus
}

export interface ContradictionRef {
  claimId: string | null
  value: string
  source: string
  page?: number
}

export interface Contradiction {
  contradictionId: string
  supplierId: string
  field: string
  leafFactorCode: string
  claimA: ContradictionRef
  claimB: ContradictionRef
  severity: ContradictionSeverity
  description: string
}

export interface MissingEvidence {
  leafFactorCode: string
  leafFactorName: string
  field: string
  df: DFCode
  applicability: string
}

export interface AIExtractionResult {
  supplierId: string
  claims: AIClaim[]
  contradictions: Contradiction[]
  missingEvidence: MissingEvidence[]
  documentClassifications: DocumentClassification[]
  extractedAt: string // ISO timestamp
}
