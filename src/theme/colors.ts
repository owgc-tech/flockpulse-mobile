export const lightColors = {
  background: "#fff",
  backgroundSecondary: "#f5f5f5",
  cardBackground: "#f5f5f5",
  text: "#111",
  textSecondary: "#555",
  textMuted: "#999",
  border: "#eee",
  divider: "#ddd",
  accent: "#2563eb",
  danger: "#dc2626",
  success: "#16a34a",
  warning: "#d97706",
  // FP-222-mobile: text/icon colors for the solid danger/warning banner strips
  // (EventIndicatorBanners). Chosen by measured WCAG contrast against the
  // strip's own background, >= 4.5:1 in both themes:
  //   onDanger  light #ffffff on #dc2626 = 4.83   dark #000000 on #ef4444 = 5.58
  //   onWarning light #111111 on #d97706 = 5.93   dark #000000 on #f59e0b = 9.78
  // (white on the dark-theme danger red is only 3.76 and white on either amber
  // is below 3.2, which is why these are not simply white in both themes.)
  onDanger: "#ffffff",
  onWarning: "#111111",
  // FP-242: assignee state pills on the Event Detail (same colors as the web
  // pills). Text on its own background, measured WCAG contrast (>= 4.5:1):
  //   committed  light #14532d on #dcfce7 = 8.30  dark #bbf7d0 on #052e16 = 12.30
  //   refused    light #7f1d1d on #fee2e2 = 8.20  dark #fecaca on #450a0a = 11.16
  //   pending    light #27272a on #f4f4f5 = 13.55  dark #f4f4f5 on #27272a = 13.55
  pillCommittedBg: "#dcfce7",
  pillCommittedText: "#14532d",
  pillCommittedBorder: "#86efac",
  pillRefusedBg: "#fee2e2",
  pillRefusedText: "#7f1d1d",
  pillRefusedBorder: "#fca5a5",
  pillPendingBg: "#f4f4f5",
  pillPendingText: "#27272a",
  pillPendingBorder: "#d4d4d8",
};

export const darkColors = {
  background: "#000",
  backgroundSecondary: "#1c1c1e",
  cardBackground: "#1c1c1e",
  text: "#f5f5f5",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  border: "#2c2c2e",
  divider: "#3a3a3c",
  accent: "#3b82f6",
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  onDanger: "#000000",
  onWarning: "#000000",
  pillCommittedBg: "#052e16",
  pillCommittedText: "#bbf7d0",
  pillCommittedBorder: "#166534",
  pillRefusedBg: "#450a0a",
  pillRefusedText: "#fecaca",
  pillRefusedBorder: "#991b1b",
  pillPendingBg: "#27272a",
  pillPendingText: "#f4f4f5",
  pillPendingBorder: "#3f3f46",
};

export type ThemeColors = typeof lightColors;
