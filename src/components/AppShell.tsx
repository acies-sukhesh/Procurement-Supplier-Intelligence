import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { ProcessStepper, type FlowStepDef } from './ProcessStepper'

const SIDEBAR_WIDTH = 288

export interface ReferenceNavItem {
  id: string
  label: string
  icon: ReactNode
}

export function AppShell({
  steps,
  current,
  completedIds,
  onGo,
  referenceItems,
  referenceCurrent,
  onGoReference,
  breadcrumb,
  pageTitle,
  pageSubtitle,
  contextChips,
  children,
}: {
  steps: FlowStepDef[]
  current: string
  completedIds: string[]
  onGo: (id: string) => void
  referenceItems: ReferenceNavItem[]
  referenceCurrent: string | null
  onGoReference: (id: string) => void
  breadcrumb: string[]
  pageTitle: string
  pageSubtitle?: string
  contextChips?: ReactNode
  children: ReactNode
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const go = (id: string) => {
    setMobileOpen(false)
    onGo(id)
  }
  const goReference = (id: string) => {
    setMobileOpen(false)
    onGoReference(id)
  }

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: 2, py: 2.5 }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1, pb: 2.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          S
        </Box>
        <Box>
          <Typography variant="subtitle2" fontWeight={800} lineHeight={1.2}>
            Supplier Evaluation
          </Typography>
          <Typography variant="caption" color="text.secondary">
            7 Decision Factors · 43 Factors
          </Typography>
        </Box>
      </Stack>

      <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ px: 1, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Evaluation flow
      </Typography>
      <ProcessStepper steps={steps} current={current} completedIds={completedIds} onGo={go} />

      <Divider sx={{ my: 2 }} />
      <Typography variant="caption" fontWeight={700} color="text.disabled" sx={{ px: 1, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Reference
      </Typography>
      <List disablePadding>
        {referenceItems.map((item) => (
          <ListItemButton
            key={item.id}
            selected={referenceCurrent === item.id}
            onClick={() => goReference(item.id)}
            sx={{
              borderRadius: 2,
              mb: 0.25,
              '&.Mui-selected': { bgcolor: 'rgba(22,87,201,0.08)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 34, color: referenceCurrent === item.id ? 'primary.main' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography variant="body2" fontWeight={referenceCurrent === item.id ? 700 : 500}>
                  {item.label}
                </Typography>
              }
            />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH } }}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            bgcolor: '#fff',
            borderRight: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {sidebarContent}
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="sticky" color="inherit" sx={{ bgcolor: '#fff' }}>
          <Toolbar sx={{ py: 1.5, minHeight: { xs: 'auto', md: 76 }, alignItems: 'flex-start', gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
            <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ width: '100%' }}>
              {isMobile && (
                <IconButton size="small" onClick={() => setMobileOpen(true)} sx={{ mt: 0.5 }}>
                  <MenuRoundedIcon />
                </IconButton>
              )}
              <Box sx={{ flex: 1, pt: 0.5, minWidth: 0 }}>
                <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 14 }} />} sx={{ mb: 0.25 }}>
                  {breadcrumb.map((b, i) => (
                    <Link key={i} underline="none" color="text.secondary" variant="caption" sx={{ cursor: 'default' }}>
                      {b}
                    </Link>
                  ))}
                </Breadcrumbs>
                <Typography variant="h6" fontWeight={700}>
                  {pageTitle}
                </Typography>
                {pageSubtitle && (
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
                    {pageSubtitle}
                  </Typography>
                )}
              </Box>
            </Stack>
            {contextChips && (
              <Stack direction="row" spacing={1} sx={{ pt: { xs: 0, md: 0.5 }, pl: { xs: isMobile ? 5 : 0, md: 0 }, flexWrap: 'wrap', justifyContent: { xs: 'flex-start', md: 'flex-end' }, width: { xs: '100%', md: 'auto' } }}>
                {contextChips}
              </Stack>
            )}
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 1400, width: '100%', mx: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
