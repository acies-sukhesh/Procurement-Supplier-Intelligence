import type { ReactNode } from 'react'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'

export interface FlowStepDef {
  id: string
  number: number
  label: string
  caption?: string
  badge?: ReactNode
}

// Vertical, numbered process nav for the sidebar — the primary "you are here"
// wayfinding device for the 9-step evaluation flow (steps 4-9 live here;
// 1-3 are pre-shell gate screens).
export function ProcessStepper({
  steps,
  current,
  completedIds,
  onGo,
}: {
  steps: FlowStepDef[]
  current: string
  completedIds: string[]
  onGo: (id: string) => void
}) {
  return (
    <List disablePadding>
      {steps.map((s, i) => {
        const done = completedIds.includes(s.id)
        const active = s.id === current
        return (
          <ListItemButton
            key={s.id}
            selected={active}
            onClick={() => onGo(s.id)}
            sx={{
              alignItems: 'flex-start',
              borderRadius: 2,
              mb: 0.25,
              py: 1,
              '&.Mui-selected': { bgcolor: 'rgba(22,87,201,0.08)' },
              '&.Mui-selected:hover': { bgcolor: 'rgba(22,87,201,0.12)' },
              '&:hover': { bgcolor: 'rgba(22,87,201,0.05)' },
            }}
          >
            <Stack direction="row" spacing={1.25} sx={{ width: '100%' }}>
              <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    bgcolor: done ? 'secondary.main' : active ? 'primary.main' : '#E4E7EC',
                    color: done || active ? '#fff' : '#5B6472',
                  }}
                >
                  {done ? <CheckRoundedIcon sx={{ fontSize: 15 }} /> : s.number}
                </Box>
                {i < steps.length - 1 && <Box sx={{ width: 2, flex: 1, minHeight: 14, bgcolor: '#E4E7EC', mt: 0.5 }} />}
              </Box>
              <ListItemText
                sx={{ my: 0 }}
                primary={
                  <Typography variant="body2" fontWeight={active ? 700 : 600} color={active ? 'primary.main' : 'text.primary'}>
                    {s.label}
                  </Typography>
                }
                secondary={
                  s.caption && (
                    <Typography variant="caption" color="text.secondary">
                      {s.caption}
                    </Typography>
                  )
                }
              />
              {s.badge}
            </Stack>
          </ListItemButton>
        )
      })}
    </List>
  )
}
