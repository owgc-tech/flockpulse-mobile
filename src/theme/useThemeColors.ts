import { useColorScheme } from "react-native";
import { lightColors, darkColors, type ThemeColors } from "./colors";
import { useThemePreference } from "./ThemePreferenceContext";

export function useThemeColors(): ThemeColors {
  const { preference } = useThemePreference();
  const systemScheme = useColorScheme();
  const scheme = preference === "system" ? systemScheme : preference;
  return scheme === "dark" ? darkColors : lightColors;
}
