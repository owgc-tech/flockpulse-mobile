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
};

export type ThemeColors = typeof lightColors;
