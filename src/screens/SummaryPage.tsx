import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import InfoRoundedIcon from '@mui/icons-material/InfoRounded'
import { runFixtures } from '../engine/fixtures'
import { SectionCard } from '../components/SectionCard'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { StatusBadge } from '../components/StatusBadge'

// Each original paragraph, broken into its constituent clauses/sentences so the
// card reads as scannable bullets rather than prose. No new claims are introduced —
// every bullet below is a verbatim fragment of the original Scope/Assumptions text.
const SCOPE: Array<{ label: string; points: string[] }> = [
  { label: 'Framework', points: [
    '7 decision factors',
    '43 leaf factors, each with a canonical backend field',
  ] },
  { label: 'Applicability', points: [
    'Fixed rule precedence: Not Applicable → Mandatory → Conditional → Default',
    'Then Criticality and Strategy upgrades',
  ] },
  { label: 'Validation', points: [
    'Presence and format checks first',
    'Then threshold banding into Pass / Watch / Below Threshold / Missing / Invalid / Critical Flag',
  ] },
  { label: 'Scoring', points: [
    'Status → score',
    'Averaged per decision factor',
    'Then a strategy-weighted readiness with a mandatory-floor gate',
  ] },
  { label: 'Ranking', points: [
    'Relative TOPSIS ranking across the five sample suppliers in the evaluation',
  ] },
  { label: 'Output', points: [
    'A comparative supplier readiness recommendation and best-fit shortlist',
    'Never a final approval, rejection, or automated decision',
  ] },
]

const ASSUMPTIONS: Array<{ label: string; points: string[] }> = [
  { label: 'Data source', points: [
    'Local JSON configuration loaded into React state',
    'No backend, database, or authentication',
  ] },
  { label: 'Sample suppliers', points: [
    'Five fixed suppliers with representative evidence values driving the demo narrative',
  ] },
  { label: 'Thresholds', points: [
    'Representative bands from the specification',
    'Fields marked provisional in the Metric Dictionary are pending review',
  ] },
  { label: 'Conditional triggers', points: [
    'Derived from the request context where an explicit flag was not supplied separately',
  ] },
  { label: 'LF7.6', points: [
    'Capacity Resilience & Redundancy follows the DF7 pattern',
    'Treated as provisional, like every other threshold',
  ] },
  { label: 'Evaluation date', points: [
    'Certificate expiry is assessed against the configurable evaluation date on the request',
  ] },
]

export default function SummaryPage() {
  const fixtures = runFixtures()
  const passed = fixtures.filter((f) => f.pass).length
  const allPass = passed === fixtures.length

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={`${passed}/${fixtures.length}`} label="Fixtures passing" tone={allPass ? 'pass' : 'critical'} />
        <KpiTile value="43" label="Leaf factors" />
        <KpiTile value="7" label="Decision factors" />
        <KpiTile value="5" label="Sample suppliers" />
      </KpiRow>

      <SectionCard
        title="Fixture verification"
        action={
          <StatusBadge
            tone={allPass ? 'pass' : 'critical'}
            label={allPass ? 'All fixtures pass' : `${fixtures.length - passed} failing`}
          />
        }
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Fixture</TableCell>
                <TableCell>Expected</TableCell>
                <TableCell>Actual</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fixtures.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    <StatusBadge tone={f.pass ? 'pass' : 'critical'} label={f.pass ? 'Pass' : 'Fail'} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{f.description}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{f.expected}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color={f.pass ? 'success.main' : 'error.main'} sx={{ fontFamily: 'monospace' }}>
                      {f.actual}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Scope" dense>
            <BulletGroups groups={SCOPE} icon={<CheckCircleRoundedIcon fontSize="small" />} tone="success.main" />
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Assumptions" dense>
            <BulletGroups groups={ASSUMPTIONS} icon={<InfoRoundedIcon fontSize="small" />} tone="primary.main" />
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  )
}

function BulletGroups({
  groups,
  icon,
  tone,
}: {
  groups: Array<{ label: string; points: string[] }>
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Stack spacing={1.75}>
      {groups.map((g) => (
        <Box key={g.label}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.65rem', mb: 0.5 }}
          >
            {g.label}
          </Typography>
          <Stack spacing={0.5}>
            {g.points.map((p, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ color: tone, display: 'flex', mt: '2px', flexShrink: 0 }}>{icon}</Box>
                <Typography variant="body2">{p}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}
