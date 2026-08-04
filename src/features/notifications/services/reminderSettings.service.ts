import AsyncStorage from "@react-native-async-storage/async-storage";

const SLOT1_HOURS_KEY = "reminder_slot1_hours";
const SLOT2_HOURS_KEY = "reminder_slot2_hours";

const DEFAULT_SLOT1_HOURS = 24;
const DEFAULT_SLOT2_HOURS = 1;

// DIP-FP-191-mobile: deliberately separate keys/defaults from
// SLOT1_HOURS_KEY/SLOT2_HOURS_KEY above rather than reusing them — those are
// already bound to the RSVP pre-event reminder feature (anchored on
// start_datetime); reusing them here would make one preference silently
// govern two semantically different reminder types anchored on different
// fields (start_datetime vs end_datetime). Same 24h/1h defaults as the
// existing pair, since the DIP asks for the same timing, just independently
// overridable.
const ANNOUNCEMENT_SLOT1_HOURS_KEY = "announcement_reminder_slot1_hours";
const ANNOUNCEMENT_SLOT2_HOURS_KEY = "announcement_reminder_slot2_hours";

const DEFAULT_ANNOUNCEMENT_SLOT1_HOURS = 24;
const DEFAULT_ANNOUNCEMENT_SLOT2_HOURS = 1;

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

// DIP-FP-191-mobile: same shape/fallback convention as
// getReminderOffsetHours() above, for the independent Announcement
// reminder-timing preference.
export async function getAnnouncementReminderOffsetHours(): Promise<ReminderOffsetHours> {
  const [slot1Raw, slot2Raw] = await Promise.all([
    AsyncStorage.getItem(ANNOUNCEMENT_SLOT1_HOURS_KEY),
    AsyncStorage.getItem(ANNOUNCEMENT_SLOT2_HOURS_KEY),
  ]);

  return {
    slot1Hours: parseHours(slot1Raw, DEFAULT_ANNOUNCEMENT_SLOT1_HOURS),
    slot2Hours: parseHours(slot2Raw, DEFAULT_ANNOUNCEMENT_SLOT2_HOURS),
  };
}

export async function setAnnouncementReminderOffsetHours(slot1Hours: number, slot2Hours: number): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(ANNOUNCEMENT_SLOT1_HOURS_KEY, String(slot1Hours)),
    AsyncStorage.setItem(ANNOUNCEMENT_SLOT2_HOURS_KEY, String(slot2Hours)),
  ]);
}
