import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_PREFERENCE_KEY = "theme_preference_override";

export type ThemePreference = "system" | "light" | "dark";

const VALID_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

function parsePreference(raw: string | null): ThemePreference {
  return raw !== null && (VALID_PREFERENCES as readonly string[]).includes(raw)
    ? (raw as ThemePreference)
    : "system";
}

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

// Default matches today's pre-DIP behavior (always follow the OS scheme) —
// same reasoning as reminderSettings.service.ts falling back to fixed
// defaults on unset/unparseable storage, so a component that somehow rendered
// outside the provider (e.g. future isolated tests) degrades to the old
// system-following behavior rather than crashing this core, 22-consumer hook.
const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  preference: "system",
  setPreference: () => {},
});

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((raw) => {
      setPreferenceState(parsePreference(raw));
    });
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, next).catch((err) => {
      console.warn("Failed to persist theme preference:", err);
    });
  };

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  return useContext(ThemePreferenceContext);
}
