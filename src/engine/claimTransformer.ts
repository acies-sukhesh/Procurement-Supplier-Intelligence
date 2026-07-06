// ---------------------------------------------------------------------------
// Claim Transformer — converts accepted AI claims into the flat metric-value
// record that the existing validation engine expects.
//
// Only claims with reviewStatus === 'Accepted' are used. When multiple
// accepted claims map to the same backendField, the one with the highest
// extractionConfidence wins.
// ---------------------------------------------------------------------------

import type { AIClaim } from './aiTypes'

/**
 * Transforms a set of accepted claims into a `{ field: value }` record
 * compatible with the existing `validateFactor()` signature.
 *
 * Numeric-looking values are converted to numbers so threshold checks work.
 */
export function transformAcceptedClaims(
  claims: AIClaim[],
): Record<string, unknown> {
  const accepted = claims.filter((c) => c.reviewStatus === 'Accepted')

  // Group by backendField, keep highest-confidence claim per field
  const bestByField = new Map<string, AIClaim>()
  for (const c of accepted) {
    const existing = bestByField.get(c.backendField)
    if (!existing || c.extractionConfidence > existing.extractionConfidence) {
      bestByField.set(c.backendField, c)
    }
  }

  const result: Record<string, unknown> = {}
  for (const [field, claim] of bestByField) {
    result[field] = coerceValue(claim.claimValue)
  }
  return result
}

/**
 * Coerce a string claim value into the appropriate JS type.
 * - Empty strings stay empty (triggers 'Missing' in validation)
 * - Numeric values become numbers
 * - Everything else stays as a string
 */
function coerceValue(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return ''

  // Already a non-string primitive (number/boolean) — pass through.
  if (typeof value !== 'string') return value

  // Date-like values (YYYY-MM-DD) stay as strings
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  // Numeric coercion
  const n = Number(value)
  if (!isNaN(n) && value.trim() !== '') return n

  return value
}
