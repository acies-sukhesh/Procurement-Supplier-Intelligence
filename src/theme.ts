import { createTheme } from '@mui/material/styles'

// Status tokens used across StatusBadge and every chart/progress element.
// Pass = green, Warning/Watch = amber, Missing/Critical = red, Locked/NA = gray.
export interface StatusToken {
  main: string
  bg: string
}

export interface StatusPalette {
  pass: StatusToken
  watch: StatusToken
  critical: StatusToken
  locked: StatusToken
  info: StatusToken
}

declare module '@mui/material/styles' {
  interface Palette {
    status: StatusPalette
  }
  interface PaletteOptions {
    status?: StatusPalette
  }
}

export const STATUS: StatusPalette = {
  pass: { main: '#1E8E5A', bg: '#E7F6EE' },
  watch: { main: '#B7791F', bg: '#FDF3DA' },
  critical: { main: '#D0342C', bg: '#FBE7E5' },
  locked: { main: '#6B7280', bg: '#F1F2F4' },
  info: { main: '#1657C9', bg: '#E9F0FE' },
}

// Supplier color scale, shared by SupplierAvatar and all charts.
export const SUPPLIER_COLORS: Record<string, string> = {
  'SUP-A': '#1657C9',
  'SUP-B': '#B7791F',
  'SUP-C': '#0E9384',
  'SUP-D': '#6E56CF',
  'SUP-E': '#D0342C',
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1657C9', dark: '#0E3F94', light: '#5B87E8', contrastText: '#ffffff' },
    secondary: { main: '#0E9384' },
    background: { default: '#F7F8FA', paper: '#FFFFFF' },
    text: { primary: '#1A1D23', secondary: '#5B6472' },
    divider: '#E4E7EC',
    error: { main: STATUS.critical.main },
    warning: { main: STATUS.watch.main },
    success: { main: STATUS.pass.main },
    status: STATUS,
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    h1: { fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  spacing: 8,
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#F7F8FA' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: '1px solid #E4E7EC',
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: 'none' },
        containedPrimary: {
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { borderBottom: '1px solid #E4E7EC' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { border: 'none' },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid #E4E7EC' },
        head: { fontWeight: 700, color: '#5B6472', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
      },
    },
  },
})
