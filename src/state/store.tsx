import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DFCode, EvaluationResult, RequestContext } from '../engine/types'
import type { AIClaim, AIExtractionResult, ClaimReviewStatus, Contradiction } from '../engine/aiTypes'
import { evaluate } from '../engine/evaluate'
import { runFullExtraction } from '../engine/aiExtraction'
import { transformAcceptedClaims } from '../engine/claimTransformer'

export const DEFAULT_CONTEXT: RequestContext = {
  industry: 'Automotive',
  part_criticality: 'High',
  production_intent: 'Yes',
  process_type: 'CNC',
  special_process_required: 'No',
  cross_border_sourcing: 'Yes',
  design_or_ip_shared: 'No',
  customer_esg_mandate: 'No',
  abac_mandated: 'No',
  contract_insurance_required: 'No',
  sourcing_strategy: 'Balanced',
  required_qms: 'IATF',
  mandated_commodity_or_ethics_requirement: 'No',
  region_blocked_or_sanctioned: 'No',
  monthly_demand: 10000,
  eval_date: '2026-07-06',
  customWeights: { DF1: 15, DF2: 15, DF3: 15, DF4: 15, DF5: 13, DF6: 13, DF7: 14 },
}

interface Store {
  context: RequestContext
  setContext: (patch: Partial<RequestContext>) => void
  setWeight: (df: DFCode, value: number) => void
  result: EvaluationResult
  baseline: EvaluationResult
  commitBaseline: () => void
  reset: () => void

  // AI Evidence Intake state
  aiExtractions: Record<string, AIExtractionResult>
  aiExtractionRunning: Record<string, boolean>
  runAIExtraction: (supplierId: string) => Promise<void>
  reviewClaim: (supplierId: string, claimId: string, status: ClaimReviewStatus, edits?: Partial<AIClaim>) => void
  reviewAllClaims: (supplierId: string, status: ClaimReviewStatus, filter?: (c: AIClaim) => boolean) => void
  getClaimsForSupplier: (supplierId: string) => AIClaim[]
  getContradictionsForSupplier: (supplierId: string) => Contradiction[]

  // Accepted claims pushed into validation, keyed by supplierId → { field: value }.
  // A supplier absent here evaluates directly from suppliers.json (unchanged).
  pushedClaims: Record<string, Record<string, unknown>>
  pushAcceptedClaims: (supplierId: string) => number // returns count of fields pushed
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [context, setContextState] = useState<RequestContext>(DEFAULT_CONTEXT)
  // Baseline context is snapshotted for the Scenario Impact before/after comparison.
  const [baselineContext, setBaselineContext] = useState<RequestContext>(DEFAULT_CONTEXT)

  // AI Evidence Intake state
  const [aiExtractions, setAIExtractions] = useState<Record<string, AIExtractionResult>>({})
  const [aiExtractionRunning, setAIExtractionRunning] = useState<Record<string, boolean>>({})
  // Claim-derived value overrides pushed into validation, per supplier.
  const [pushedClaims, setPushedClaims] = useState<Record<string, Record<string, unknown>>>({})

  const setContext = (patch: Partial<RequestContext>) => setContextState((c) => ({ ...c, ...patch }))
  const setWeight = (df: DFCode, value: number) =>
    setContextState((c) => ({ ...c, customWeights: { ...(c.customWeights ?? DEFAULT_CONTEXT.customWeights!), [df]: value } }))

  const result = useMemo(() => evaluate(context, pushedClaims), [context, pushedClaims])
  const baseline = useMemo(() => evaluate(baselineContext), [baselineContext])

  // Transform this supplier's accepted claims and merge them into the values the
  // validation engine reads. Additive: only the pushed supplier is affected.
  const pushAcceptedClaims = (supplierId: string): number => {
    const claims = aiExtractions[supplierId]?.claims ?? []
    const values = transformAcceptedClaims(claims)
    setPushedClaims((p) => ({ ...p, [supplierId]: values }))
    return Object.keys(values).length
  }

  const runAIExtractionFn = async (supplierId: string) => {
    setAIExtractionRunning((s) => ({ ...s, [supplierId]: true }))
    // Simulate async AI processing (1.5s delay for realism)
    await new Promise((r) => setTimeout(r, 1500))
    const extraction = runFullExtraction(supplierId, result.applicability)
    setAIExtractions((s) => ({ ...s, [supplierId]: extraction }))
    setAIExtractionRunning((s) => ({ ...s, [supplierId]: false }))
  }

  const reviewClaim = (supplierId: string, claimId: string, status: ClaimReviewStatus, edits?: Partial<AIClaim>) => {
    setAIExtractions((s) => {
      const ext = s[supplierId]
      if (!ext) return s
      return {
        ...s,
        [supplierId]: {
          ...ext,
          claims: ext.claims.map((c) =>
            c.claimId === claimId ? { ...c, ...edits, reviewStatus: status } : c,
          ),
        },
      }
    })
  }

  const reviewAllClaims = (supplierId: string, status: ClaimReviewStatus, filter?: (c: AIClaim) => boolean) => {
    setAIExtractions((s) => {
      const ext = s[supplierId]
      if (!ext) return s
      return {
        ...s,
        [supplierId]: {
          ...ext,
          claims: ext.claims.map((c) => {
            if (filter && !filter(c)) return c
            if (c.reviewStatus !== 'Pending') return c
            return { ...c, reviewStatus: status }
          }),
        },
      }
    })
  }

  const getClaimsForSupplier = (supplierId: string): AIClaim[] => {
    return aiExtractions[supplierId]?.claims ?? []
  }

  const getContradictionsForSupplier = (supplierId: string): Contradiction[] => {
    return aiExtractions[supplierId]?.contradictions ?? []
  }

  const store: Store = {
    context,
    setContext,
    setWeight,
    result,
    baseline,
    commitBaseline: () => setBaselineContext(context),
    reset: () => setContextState(DEFAULT_CONTEXT),

    aiExtractions,
    aiExtractionRunning,
    runAIExtraction: runAIExtractionFn,
    reviewClaim,
    reviewAllClaims,
    getClaimsForSupplier,
    getContradictionsForSupplier,

    pushedClaims,
    pushAcceptedClaims,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
