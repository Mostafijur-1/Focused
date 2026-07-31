export const focusedTokens = {
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  },
  containers: {
    app: 1440,
    reading: 760,
    form: 640,
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96],
  radius: {
    control: 12,
    card: 16,
    panel: 20,
    hero: 24,
    pill: 999,
  },
  controlHeight: {
    compact: 36,
    default: 44,
    large: 52,
  },
  typography: {
    family: '"Inter Variable", "Noto Sans Bengali Variable", "Noto Sans Bengali", system-ui, sans-serif',
    banglaLineHeight: 1.62,
    latinLineHeight: 1.5,
    scale: {
      display: { size: 56, lineHeight: 1.08, weight: 700 },
      h1: { size: 40, lineHeight: 1.18, weight: 700 },
      h2: { size: 32, lineHeight: 1.25, weight: 650 },
      h3: { size: 24, lineHeight: 1.35, weight: 650 },
      title: { size: 20, lineHeight: 1.4, weight: 600 },
      body: { size: 16, lineHeight: 1.62, weight: 400 },
      label: { size: 14, lineHeight: 1.45, weight: 550 },
      caption: { size: 12, lineHeight: 1.5, weight: 500 },
    },
  },
  motion: {
    instant: 80,
    fast: 120,
    standard: 180,
    deliberate: 240,
    enter: 320,
    easing: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      emphasized: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      exit: "cubic-bezier(0.4, 0, 1, 1)",
    },
  },
  zIndex: {
    base: 0,
    sticky: 20,
    dropdown: 40,
    overlay: 50,
    modal: 60,
    toast: 70,
    command: 80,
  },
} as const;

export type FocusedTokens = typeof focusedTokens;
