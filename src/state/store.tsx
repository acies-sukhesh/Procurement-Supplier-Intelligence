import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DFCode, EvaluationResult, RequestContext, SavedScenario } from '../engine/types'
import type { AIClaim, AIExtractionResult, ClaimReviewStatus, Contradiction } from '../engine/aiTypes'
import { evaluate, getStrategy, getWeights } from '../engine/evaluate'
import { runFullExtraction } from '../engine/aiExtraction'
import { transformAcceptedClaims } from '../engine/claimTransformer'
import { COMPONENT_PRESETS } from '../data/componentPresets'

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

// Demo preset: identical to the reference context except part criticality is Medium.
export const MEDIUM_CRITICALITY_CONTEXT: RequestContext = {
  ...DEFAULT_CONTEXT,
  part_criticality: 'Medium',
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
  pushedClaims: Record<string, Record<string, unknown>>
  pushAcceptedClaims: (supplierId: string) => number

  // Evidence follow-up requests per supplier.
  followUps: Record<string, { count: number; lastAt: string }>
  recordFollowUp: (supplierId: string) => void

  // User factor selections: true = included, false = skipped.
  // Only non-locked factors (system-recommended, optional) can be toggled.
  // Absent keys use the engine default (recommended = included, optional = excluded).
  userSelections: Record<string, boolean>
  setUserSelection: (code: string, included: boolean) => void
  resetUserSelections: () => void

  // Multi-scenario persistence: stores inputs only, results recomputed live.
  savedScenarios: SavedScenario[]
  saveScenario: (name: string) => void
  deleteScenario: (id: string) => void
  loadScenario: (id: string) => void

  // Front-end-only gate flow: manufacturer login, use case, and component
  // selection. None of this feeds evaluate() directly — selectedComponent
  // applies its defaults via the existing setContext() as a convenience only.
  authed: boolean
  manufacturerName: string | null
  login: (name: string) => void
  logout: () => void
  useCaseId: string | null
  setUseCaseId: (id: string) => void
  componentId: string | null
  setComponentId: (id: string) => void
}

// Max follow-up requests before the supplier is left to be scored/labeled as-is.
export const FOLLOWUP_LIMIT = 2

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
  // Evidence follow-up request log, per supplier.
  const [followUps, setFollowUps] = useState<Record<string, { count: number; lastAt: string }>>({})

  // User factor selections: boolean map for non-locked factors.
  const [userSelections, setUserSelectionsState] = useState<Record<string, boolean>>({})

  // Saved scenarios — in-memory only, session-only (lost on page refresh, by design).
  const [savedScenarios, setSavedScenariosState] = useState<SavedScenario[]>([])

  // Gate flow: login, use case, component — front-end-only, session-only.
  const [authed, setAuthed] = useState(false)
  const [manufacturerName, setManufacturerName] = useState<string | null>(null)
  const [useCaseId, setUseCaseIdState] = useState<string | null>(null)
  const [componentId, setComponentIdState] = useState<string | null>(null)

  const setContext = (patch: Partial<RequestContext>) => setContextState((c) => ({ ...c, ...patch }))
  const setWeight = (df: DFCode, value: number) =>
    setContextState((c) => ({ ...c, customWeights: { ...(c.customWeights ?? DEFAULT_CONTEXT.customWeights!), [df]: value } }))

  // Core evaluation: now passes userSelections into the engine.
  const result = useMemo(() => evaluate(context, pushedClaims, userSelections), [context, pushedClaims, userSelections])
  const baseline = useMemo(() => evaluate(baselineContext), [baselineContext])

  // Transform this supplier's accepted claims and merge them into the values the
  // validation engine reads. Additive: only the pushed supplier is affected.
  const pushAcceptedClaims = (supplierId: string): number => {
    const claims = aiExtractions[supplierId]?.claims ?? []
    const values = transformAcceptedClaims(claims)
    setPushedClaims((p) => ({ ...p, [supplierId]: values }))
    return Object.keys(values).length
  }

  const recordFollowUp = (supplierId: string) => {
    setFollowUps((f) => ({
      ...f,
      [supplierId]: { count: (f[supplierId]?.count ?? 0) + 1, lastAt: new Date().toISOString() },
    }))
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

  // ── Scenario management ────────────────────────────────────────────

  const saveScenario = (name: string) => {
    const strategy = getStrategy(context)
    const weights = getWeights(context, strategy)
    const scenario: SavedScenario = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name,
      timestamp: new Date().toISOString(),
      context: { ...context },
      weights: { ...weights },
      userSelections: { ...userSelections },
    }
    setSavedScenariosState((prev) => [...prev, scenario])
  }

  const deleteScenario = (id: string) => {
    setSavedScenariosState((prev) => prev.filter((s) => s.id !== id))
  }

  const loadScenarioFn = (id: string) => {
    const s = savedScenarios.find((sc) => sc.id === id)
    if (!s) return
    setContextState(s.context)
    setUserSelectionsState(s.userSelections)
  }

  // ── Gate flow ───────────────────────────────────────────────────────

  const setComponentId = (id: string) => {
    setComponentIdState(id)
    const preset = COMPONENT_PRESETS.find((p) => p.id === id)
    if (preset) setContext(preset.defaults)
  }

  const store: Store = {
    context,
    setContext,
    setWeight,
    result,
    baseline,
    commitBaseline: () => setBaselineContext(context),
    reset: () => { setContextState(DEFAULT_CONTEXT); setUserSelectionsState({}) },

    aiExtractions,
    aiExtractionRunning,
    runAIExtraction: runAIExtractionFn,
    reviewClaim,
    reviewAllClaims,
    getClaimsForSupplier,
    getContradictionsForSupplier,

    pushedClaims,
    pushAcceptedClaims,

    followUps,
    recordFollowUp,

    userSelections,
    setUserSelection: (code, included) => setUserSelectionsState((m) => ({ ...m, [code]: included })),
    resetUserSelections: () => setUserSelectionsState({}),

    savedScenarios,
    saveScenario,
    deleteScenario,
    loadScenario: loadScenarioFn,

    authed,
    manufacturerName,
    login: (name: string) => { setManufacturerName(name); setAuthed(true) },
    logout: () => { setAuthed(false); setManufacturerName(null); setUseCaseIdState(null); setComponentIdState(null) },
    useCaseId,
    setUseCaseId: setUseCaseIdState,
    componentId,
    setComponentId,
  }
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used within StoreProvider')
  return s
}
