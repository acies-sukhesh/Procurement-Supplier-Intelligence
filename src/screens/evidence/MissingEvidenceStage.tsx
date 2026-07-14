import { useMemo, useState } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import { useStore, FOLLOWUP_LIMIT } from '../../state/store'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { AppDialog } from '../../components/AppDialog'
import { EmptyState } from '../../components/States'
import { StatusBadge } from '../../components/StatusBadge'
import { buildGapRegister, whyItMatters, expectedEvidenceExamples, type GapRow } from '../../engine/evidence'
import type { RequestContext } from '../../engine/types'
import suppliers from '../../data/suppliers.json'

interface FollowUpDraft { to: string; subject: string; body: string }

function buildFollowUpDraft(to: string, supplierName: string, ctx: RequestContext, rows: GapRow[]): FollowUpDraft {
  const n = rows.length
  const subject = `Evidence Request Follow-up — ${ctx.part_criticality} ${ctx.industry} part evaluation — ${n} item${n === 1 ? '' : 's'} outstanding`
  const items = rows
    .map((r, i) => `${i + 1}. ${r.name}\n   Why it matters: ${whyItMatters(r.field)}\n   Expected evidence: ${expectedEvidenceExamples(r.field).join(' / ')}`)
    .join('\n\n')
  const body = `Dear ${supplierName} team,\n\nAs part of our ${ctx.part_criticality} ${ctx.industry} sourcing evaluation, the following evidence items are still outstanding:\n\n${items}\n\nPlease provide the above documentation at your earliest convenience so we can complete the assessment.\n\nRegards,\nProcurement Team`
  return { to, subject, body }
}
function draftToMailto(d: FollowUpDraft): string {
  return `mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`
}

export default function MissingEvidenceStage() {
  const { result, followUps, recordFollowUp } = useStore()
  const rows = useMemo(() => buildGapRegister(result), [result])
  const [draft, setDraft] = useState<FollowUpDraft | null>(null)
  const [copied, setCopied] = useState(false)

  const missing = rows.filter((r) => r.gapState === 'Missing').length
  const weak = rows.length - missing
  const missingBySupplier = useMemo(() => {
    const m: Record<string, GapRow[]> = {}
    rows.forEach((r) => r.gapState === 'Missing' && (m[r.supplierId] ??= []).push(r))
    return m
  }, [rows])

  if (rows.length === 0) {
    return <EmptyState title="No evidence gaps" description="Every in-scope factor has strong evidence under the current request." />
  }

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={missing} label="Missing" tone="critical" />
        <KpiTile value={weak} label="Weak" tone="watch" />
        <KpiTile value={rows.length} label="Total gaps" />
      </KpiRow>

      <SectionCard title="Evidence gaps" hint="Weak or missing evidence across all suppliers, ranked by factor criticality.">
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Supplier</TableCell>
                <TableCell>Factor</TableCell>
                <TableCell>Applicability</TableCell>
                <TableCell>Gap</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>Recommended action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.supplierId}-${r.code}-${i}`} hover>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <SupplierAvatar id={r.supplierId} name={r.supplierId} size={22} />
                      <Typography variant="body2" fontWeight={600}>{r.supplierId}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="caption">{r.applicability}</Typography></TableCell>
                  <TableCell><StatusBadge tone={r.gapState === 'Missing' ? 'critical' : 'watch'} label={r.gapState} icon={false} /></TableCell>
                  <TableCell><Typography variant="body2">{r.confidence === null ? '—' : r.confidence.toFixed(2)}</Typography></TableCell>
                  <TableCell><Typography variant="caption" color="text.secondary">{r.action}</Typography></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>

      {Object.keys(missingBySupplier).length > 0 && (
        <SectionCard title="Request follow-up on missing evidence">
          <Stack spacing={1.5}>
            {Object.entries(missingBySupplier).map(([sid, mrows]) => {
              const sup = suppliers.find((s) => s.id === sid)
              const fu = followUps[sid]
              const count = fu?.count ?? 0
              const reached = count >= FOLLOWUP_LIMIT
              return (
                <Stack key={sid} direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 1.25, borderBottom: '1px dashed #E4E7EC' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <SupplierAvatar id={sid} name={sid} size={22} />
                    <Typography variant="body2" fontWeight={600}>{sid}</Typography>
                    <Typography variant="caption" color="text.secondary">{mrows.length} missing item{mrows.length === 1 ? '' : 's'}</Typography>
                    {count > 0 && <Typography variant="caption" color="text.secondary">· requested {count}×</Typography>}
                  </Stack>
                  {reached ? (
                    <StatusBadge tone="watch" label="Follow-up limit reached" icon={false} />
                  ) : sup?.contact_email ? (
                    <Button
                      size="small"
                      startIcon={<FlagRoundedIcon fontSize="small" />}
                      onClick={() => {
                        recordFollowUp(sid)
                        setDraft(buildFollowUpDraft(sup.contact_email, sup.name, result.context, mrows))
                      }}
                    >
                      Draft follow-up ({mrows.length})
                    </Button>
                  ) : null}
                </Stack>
              )
            })}
          </Stack>
        </SectionCard>
      )}

      {draft && (
        <AppDialog
          open
          onClose={() => setDraft(null)}
          title="Follow-up email draft"
          actions={
            <>
              <Button href={draftToMailto(draft)} sx={{ mr: 'auto' }}>Open in email client</Button>
              <Button onClick={() => setDraft(null)}>Close</Button>
              <Button
                variant="contained"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`To: ${draft.to}\nSubject: ${draft.subject}\nBody:\n${draft.body}`)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    /* clipboard unavailable */
                  }
                }}
              >
                {copied ? 'Copied ✓' : 'Copy to clipboard'}
              </Button>
            </>
          }
        >
          <Stack spacing={1.5}>
            <Box><Typography variant="caption" color="text.secondary">To</Typography><Typography variant="body2">{draft.to}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Subject</Typography><Typography variant="body2">{draft.subject}</Typography></Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Body</Typography>
              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', bgcolor: '#F7F8FA', p: 1.5, borderRadius: 1.5 }}>
                {draft.body}
              </Typography>
            </Box>
          </Stack>
        </AppDialog>
      )}
    </Stack>
  )
}
