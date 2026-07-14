import { useMemo, useState } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import LinearProgress from '@mui/material/LinearProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { useStore } from '../../state/store'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { AppDrawer } from '../../components/AppDrawer'
import { AppDialog } from '../../components/AppDialog'
import { EmptyState } from '../../components/States'
import { ClaimTypeBadge, ClaimReviewBadge, QualityBadge } from '../../components/StatusBadge'
import { getDFName, describeClaimMapping } from '../../engine/aiExtraction'
import suppliers from '../../data/suppliers.json'
import type { AIClaim, AIClaimType, ClaimReviewStatus } from '../../engine/aiTypes'

const DFS = ['DF1', 'DF2', 'DF3', 'DF4', 'DF5', 'DF6', 'DF7']

export default function MappedFactorsStage({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { aiExtractions, reviewClaim, pushAcceptedClaims } = useStore()
  const [filterSup, setFilterSup] = useState('all')
  const [filterDF, setFilterDF] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'all' | ClaimReviewStatus>('all')
  const [filterType, setFilterType] = useState<'all' | AIClaimType>('all')
  const [selected, setSelected] = useState<AIClaim | null>(null)
  const [editing, setEditing] = useState<AIClaim | null>(null)
  const [pushed, setPushed] = useState<{ suppliers: string[]; fields: number } | null>(null)

  const extractedSups = suppliers.filter((s) => aiExtractions[s.id])
  const allClaims = useMemo(() => Object.values(aiExtractions).flatMap((e) => e.claims), [aiExtractions])

  const filtered = useMemo(
    () =>
      allClaims.filter((c) => {
        if (filterSup !== 'all' && c.supplierId !== filterSup) return false
        if (filterDF !== 'all' && c.mappedDecisionFactor !== filterDF) return false
        if (filterStatus !== 'all' && c.reviewStatus !== filterStatus) return false
        if (filterType !== 'all' && c.claimType !== filterType) return false
        return true
      }),
    [allClaims, filterSup, filterDF, filterStatus, filterType],
  )

  const counts = useMemo(() => {
    const r: Record<ClaimReviewStatus, number> = { Pending: 0, Accepted: 0, Rejected: 0 }
    allClaims.forEach((c) => (r[c.reviewStatus] += 1))
    return r
  }, [allClaims])

  const acceptAllPending = () => filtered.filter((c) => c.reviewStatus === 'Pending').forEach((c) => reviewClaim(c.supplierId, c.claimId, 'Accepted'))
  const rejectLowConf = () =>
    filtered.filter((c) => c.reviewStatus === 'Pending' && c.extractionConfidence < 0.5).forEach((c) => reviewClaim(c.supplierId, c.claimId, 'Rejected'))

  const acceptedSups = useMemo(() => {
    const set = new Set<string>()
    allClaims.forEach((c) => c.reviewStatus === 'Accepted' && set.add(c.supplierId))
    return set
  }, [allClaims])
  const pushTargets = (filterSup === 'all' ? [...acceptedSups] : [filterSup]).filter((id) => acceptedSups.has(id))
  const doPush = () => setPushed({ suppliers: pushTargets, fields: pushTargets.reduce((n, id) => n + pushAcceptedClaims(id), 0) })

  if (allClaims.length === 0) {
    return <EmptyState title="No claims to review yet" description="Run extraction on the Extraction Status stage first — extracted claims will appear here for review." />
  }

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={allClaims.length} label="Total claims" />
        <KpiTile value={counts.Pending} label="Pending" tone="watch" />
        <KpiTile value={counts.Accepted} label="Accepted" tone="pass" />
        <KpiTile value={counts.Rejected} label="Rejected" tone="critical" />
      </KpiRow>

      <SectionCard title="Review extracted claims" hint="Only accepted claims flow into Supplier Evaluation.">
        <Stack direction="row" spacing={1.25} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <TextField select size="small" label="Supplier" value={filterSup} onChange={(e) => setFilterSup(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All suppliers</MenuItem>
            {extractedSups.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Decision factor" value={filterDF} onChange={(e) => setFilterDF(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="all">All factors</MenuItem>
            {DFS.map((df) => (
              <MenuItem key={df} value={df}>{df} · {getDFName(df)}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Accepted">Accepted</MenuItem>
            <MenuItem value="Rejected">Rejected</MenuItem>
          </TextField>
          <TextField select size="small" label="Type" value={filterType} onChange={(e) => setFilterType(e.target.value as any)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All types</MenuItem>
            <MenuItem value="Explicit">Explicit</MenuItem>
            <MenuItem value="Inferred">Inferred</MenuItem>
            <MenuItem value="Negative">Negative</MenuItem>
            <MenuItem value="Absent">Absent</MenuItem>
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={acceptAllPending}>Accept all pending</Button>
          <Button size="small" color="error" onClick={rejectLowConf}>Reject low confidence</Button>
          <Button size="small" variant="contained" disabled={pushTargets.length === 0} onClick={doPush}>
            Push accepted claims
          </Button>
        </Stack>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell>Claim</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Factor</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Quality</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((claim) => {
                const m = describeClaimMapping(claim)
                return (
                  <TableRow key={claim.claimId} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(claim)}>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SupplierAvatar id={claim.supplierId} name={claim.supplierId} size={22} />
                        <Typography variant="body2" fontWeight={600}>{claim.supplierId}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="body2" noWrap>{claim.claimText}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{claim.claimValue || '—'}{claim.unit ? ` ${claim.unit}` : ''}</Typography>
                    </TableCell>
                    <TableCell><ClaimTypeBadge type={claim.claimType} /></TableCell>
                    <TableCell>
                      {m.scored ? (
                        <Typography variant="caption">{claim.mappedDecisionFactor} · {claim.mappedLeafFactor}</Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">{m.notScoredLabel}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ minWidth: 90 }}>
                      <LinearProgress
                        variant="determinate"
                        value={claim.extractionConfidence * 100}
                        color={claim.extractionConfidence >= 0.85 ? 'success' : claim.extractionConfidence >= 0.6 ? 'warning' : 'error'}
                        sx={{ borderRadius: 4, height: 6 }}
                      />
                    </TableCell>
                    <TableCell><QualityBadge quality={claim.evidenceQuality} /></TableCell>
                    <TableCell><ClaimReviewBadge status={claim.reviewStatus} /></TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Accept">
                        <IconButton size="small" color="success" onClick={() => reviewClaim(claim.supplierId, claim.claimId, 'Accepted')}>
                          <CheckRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reject">
                        <IconButton size="small" color="error" onClick={() => reviewClaim(claim.supplierId, claim.claimId, 'Rejected')}>
                          <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditing(claim)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>

      {pushed && (
        <SectionCard dense>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Pushed {pushed.fields} claim-derived field{pushed.fields === 1 ? '' : 's'} for {pushed.suppliers.join(', ')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supplier Evaluation now reflects the accepted claims.
              </Typography>
            </Box>
            <Button variant="contained" size="small" onClick={() => onNavigate?.('evaluation')}>
              View in Supplier Evaluation →
            </Button>
          </Stack>
        </SectionCard>
      )}

      {selected && (
        <AppDrawer open onClose={() => setSelected(null)} title={selected.claimText} subtitle={`${selected.claimId} · ${selected.supplierId} · ${selected.mappedLeafFactor}`}>
          <ClaimDetail claim={selected} onClose={() => setSelected(null)} />
        </AppDrawer>
      )}
      {editing && (
        <AppDialog open onClose={() => setEditing(null)} title="Edit claim">
          <EditClaimForm claim={editing} onClose={() => setEditing(null)} />
        </AppDialog>
      )}
    </Stack>
  )
}

function ClaimDetail({ claim, onClose }: { claim: AIClaim; onClose: () => void }) {
  const { reviewClaim } = useStore()
  const m = describeClaimMapping(claim)
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <ClaimTypeBadge type={claim.claimType} />
        <ClaimReviewBadge status={claim.reviewStatus} />
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary">Extracted value</Typography>
        <Typography variant="h6" fontWeight={700}>{claim.claimValue || '—'} {claim.unit ?? ''}</Typography>
      </Box>
      {claim.directQuote && (
        <Box sx={{ bgcolor: '#F7F8FA', borderLeft: '3px solid', borderColor: 'primary.main', borderRadius: 1, p: 1.5 }}>
          <Typography variant="body2" fontStyle="italic">"{claim.directQuote}"</Typography>
        </Box>
      )}
      <Stack spacing={0.75}>
        <Row label="Document" value={claim.documentName} />
        <Row label="Page" value={String(claim.sourcePage ?? '—')} />
        <Row label="Mapping" value={m.scored ? `${m.dfLabel} / ${m.lfLabel}` : m.notScoredLabel} />
        <Row label="Backend field" value={claim.backendField} />
        <Row label="Confidence" value={`${Math.round(claim.extractionConfidence * 100)}%`} />
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button fullWidth variant="contained" color="success" startIcon={<CheckRoundedIcon />} onClick={() => { reviewClaim(claim.supplierId, claim.claimId, 'Accepted'); onClose() }}>
          Accept
        </Button>
        <Button fullWidth variant="outlined" color="error" startIcon={<CloseRoundedIcon />} onClick={() => { reviewClaim(claim.supplierId, claim.claimId, 'Rejected'); onClose() }}>
          Reject
        </Button>
      </Stack>
    </Stack>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Stack>
  )
}

function EditClaimForm({ claim, onClose }: { claim: AIClaim; onClose: () => void }) {
  const { reviewClaim } = useStore()
  const [value, setValue] = useState(claim.claimValue)
  const [unit, setUnit] = useState(claim.unit ?? '')
  const [mappedDF, setMappedDF] = useState(claim.mappedDecisionFactor)
  const [mappedLF, setMappedLF] = useState(claim.mappedLeafFactor)

  const save = () => {
    reviewClaim(claim.supplierId, claim.claimId, 'Accepted', { claimValue: value, unit: unit || null, mappedDecisionFactor: mappedDF, mappedLeafFactor: mappedLF })
    onClose()
  }

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">{claim.claimId} · {claim.supplierId}</Typography>
      <TextField label="Extracted value" value={value} onChange={(e) => setValue(e.target.value)} size="small" fullWidth />
      <TextField label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} size="small" fullWidth placeholder="e.g. %, ratio, days" />
      <TextField select label="Decision factor" value={mappedDF} onChange={(e) => setMappedDF(e.target.value)} size="small" fullWidth>
        {DFS.map((df) => (
          <MenuItem key={df} value={df}>{df} · {getDFName(df)}</MenuItem>
        ))}
      </TextField>
      <TextField label="Leaf factor" value={mappedLF} onChange={(e) => setMappedLF(e.target.value)} size="small" fullWidth />
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>Save & accept</Button>
      </Stack>
    </Stack>
  )
}
