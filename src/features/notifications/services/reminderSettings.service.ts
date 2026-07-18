import AsyncStorage from "@react-native-async-storage/async-storage";

const SLOT1_HOURS_KEY = "reminder_slot1_hours";
const SLOT2_HOURS_KEY = "reminder_slot2_hours";

const DEFAULT_SLOT1_HOURS = 24;
const DEFAULT_SLOT2_HOURS = 1;

export interface ReminderOffsetHours {
  slot1Hours: number;
  slot2Hours: number;
}

function parseHours(raw: string | null, fallback: number): number {
  const parsed = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

// DIP-FP-110: falls back to today's fixed defaults (24h/1h) whenever either
// key is unset (member never customized) or unparseable, so pre-existing
// installs and fresh installs behave identically to pre-DIP behavior until a
// member explicitly saves a change on the Preferences screen.
export async function getReminderOffsetHours(): Promise<ReminderOffsetHours> {
  const [slot1Raw, slot2Raw] = await Promise.all([
    AsyncStorage.getItem(SLOT1_HOURS_KEY),
    AsyncStorage.getItem(SLOT2_HOURS_KEY),
  ]);

  return {
    slot1Hours: parseHours(slot1Raw, DEFAULT_SLOT1_HOURS),
    slot2Hours: parseHours(slot2Raw, DEFAULT_SLOT2_HOURS),
  };
}

export async function setReminderOffsetHours(slot1Hours: number, slot2Hours: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(SLOT1_HOURS_KEY, String(slot1Hours)),
    AsyncStorage.setItem(SLOT2_HOURS_KEY, String(slot2Hours)),
  ]);
}
