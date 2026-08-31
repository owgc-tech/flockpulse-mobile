import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SwipeableTabScreen } from "@/src/features/navigation/SwipeableTabScreen";
import {
  getDashboardStats,
  getDefaultDashboard,
  listEventsForType,
  listEventTypes,
} from "@/src/features/dashboard/services/dashboard.service";
import type {
  DashboardEventOption,
  DashboardEventType,
  DashboardRsvpStats,
  DashboardStats,
} from "@/src/features/dashboard/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

// DIP-FP-182-mobile: no role/visibility branching anywhere in this file —
// getDefaultDashboard/listEventsForType/getDashboardStats are trusted as-is.
// A Member and an Admin see different dropdown contents and different
// defaults purely because the API responses differ for each.

function formatEventOptionLabel(option: DashboardEventOption): string {
  if (!option.start_datetime) return option.name;
  const datePrefix = new Date(option.start_datetime).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${datePrefix} — ${option.name}`;
}

// Ratio-based banding for Attendance/RSVP — straightforward since both are
// already simple 0-1 rates, unlike Rating & Feedback below.
function rateBandColor(colors: ThemeColors, ratio: number): string {
  if (ratio >= 0.75) return colors.success;
  if (ratio >= 0.5) return colors.warning;
  return colors.danger;
}

// Bands on `rounded` (server-computed Math.round(average)), deliberately
// separate from the raw `average` this card displays as text (e.g. a 3.98
// isn't banded any harsher than a 4.01) — see DashboardRatingStats in types.ts.
function ratingBandColor(colors: ThemeColors, rounded: number | null): string {
  if (rounded === null) return colors.textMuted;
  if (rounded >= 4) return colors.success;
  if (rounded === 3) return colors.warning;
  return colors.danger;
}

// DIP-FP-182-mobile-adj-2: green-to-red gradient for the Rating card's five
// bar rows — alpha-blended from the existing three semantic colors (success/
// warning/danger), not new raw hex values. "b3" (~70% alpha) is the same
// suffix convention used for pale-tint card backgrounds elsewhere in this
// file, just at a stronger opacity since these are solid bar fills, not tints.
function starBarColor(colors: ThemeColors, star: number): string {
  switch (star) {
    case 5:
      return colors.success;
    case 4:
      return colors.success + "b3";
    case 3:
      return colors.warning;
    case 2:
      return colors.danger + "b3";
    default:
      return colors.danger;
  }
}

const STAR_ORDER = [5, 4, 3, 2, 1];

// One row = colored label+count on the left, a horizontal bar on the right
// scaled against the largest count in the same card. The track (low-opacity
// version of the bar color) keeps a 0-width bar visually anchored instead of
// disappearing entirely.
function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const widthPct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color }]} numberOfLines={1}>
        {label}: {count}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: color + "22" }]}>
        <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    label: { color: colors.text },
    input: { borderColor: colors.border, backgroundColor: colors.cardBackground },
    inputText: { color: colors.text },
    placeholderText: { color: colors.textMuted },
    empty: { color: colors.textSecondary },
    error: { color: colors.danger },
    retryButton: { backgroundColor: colors.accent },
    sectionHeading: { color: colors.text },
    cardMeta: { color: colors.textSecondary },
    modalContainer: { backgroundColor: colors.background },
    modalTitle: { color: colors.text },
    doneText: { color: colors.accent },
    optionRow: { borderBottomColor: colors.border },
    optionRowSelected: { backgroundColor: colors.backgroundSecondary },
    optionLabel: { color: colors.text },
    optionLabelSelected: { color: colors.accent },
    feedbackText: { color: colors.textSecondary },
    feedbackEmpty: { color: colors.textMuted },
  });
}

interface DropdownFieldProps<T> {
  label: string;
  // DIP-FP-182-mobile-adj-3: separate from `label` so the Modal sheet still
  // has a meaningful title ("Event Type"/"Event") even now that `label`
  // itself is "" on the field caption (see the shared "Events" heading
  // above both DropdownFields). Falls back to `label` when omitted.
  modalTitle?: string;
  value: T | null;
  options: T[];
  keyExtractor: (item: T) => string;
  renderLabel: (item: T) => string;
  onSelect: (item: T) => void;
  themed: ReturnType<typeof getThemedStyles>;
  testID: string;
}

// Single-level Pressable-input + slide-up Modal + FlatList picker, mirroring
// app/(app)/events/create.tsx's FormationTalkPicker/MeetingResourcePicker
// convention exactly (same shape, no course/module drill-down needed here).
function DropdownField<T>({
  label,
  modalTitle,
  value,
  options,
  keyExtractor,
  renderLabel,
  onSelect,
  themed,
  testID,
}: DropdownFieldProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, themed.label]}>{label}</Text> : null}
      <Pressable style={[styles.input, themed.input]} onPress={() => setIsOpen(true)} testID={`${testID}-open`}>
        <Text style={value ? themed.inputText : themed.placeholderText}>
          {value ? renderLabel(value) : "Select…"}
        </Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.modalContainer, themed.modalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, themed.modalTitle]}>{modalTitle ?? label}</Text>
            <Pressable onPress={() => setIsOpen(false)} testID={`${testID}-close`}>
              <Text style={[styles.doneText, themed.doneText]}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => {
              const isSelected = value !== null && keyExtractor(item) === keyExtractor(value);
              return (
                <Pressable
                  style={[styles.optionRow, themed.optionRow, isSelected && themed.optionRowSelected]}
                  onPress={() => {
                    onSelect(item);
                    setIsOpen(false);
                  }}
                  testID={`${testID}-option-${keyExtractor(item)}`}
                >
                  <Text style={[styles.optionLabel, themed.optionLabel, isSelected && themed.optionLabelSelected]}>
                    {renderLabel(item)}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

// DIP-FP-182-mobile-adj-4: Responded-first order, per Joseph's exact
// wording — replaces adj-3's Accepted-first order entirely. "Responded"
// combines the three actual-response counts (accepted+declined+tentative),
// deliberately excluding Not Responded.
const RSVP_CYCLE = ["RESPONDED", "ACCEPTED", "DECLINED", "TENTATIVE", "NO_RESPONSE"] as const;
type RsvpCycleView = (typeof RSVP_CYCLE)[number];

// DIP-FP-182-mobile-adj-4: percentages, not raw counts — adj-3's own DIP
// text specified percentages and this was missed in review; corrected here.
// total is the sum of all four raw counts, same denominator concept as
// rsvpMax below, just not previously applied to the headline. "—" when
// total is 0, same guard pattern as attendancePercent's null case.
function rsvpHeadline(view: RsvpCycleView, rsvp: DashboardRsvpStats): string {
  const total = rsvp.yes_count + rsvp.no_count + rsvp.tentative_count + rsvp.no_response_count;
  const pct = (value: number) => (total > 0 ? `${Math.round((value / total) * 100)}%` : "—");

  switch (view) {
    case "RESPONDED":
      return `${pct(rsvp.yes_count + rsvp.no_count + rsvp.tentative_count)} responded`;
    case "ACCEPTED":
      return `${pct(rsvp.yes_count)} accepted`;
    case "DECLINED":
      return `${pct(rsvp.no_count)} declined`;
    case "TENTATIVE":
      return `${pct(rsvp.tentative_count)} tentative`;
    case "NO_RESPONSE":
      return `${pct(rsvp.no_response_count)} not responded`;
  }
}

function StatsCards({ stats, themed }: { stats: DashboardStats; themed: ReturnType<typeof getThemedStyles> }) {
  const colors = useThemeColors();

  // Resets to "Responded" (index 0) whenever the selected event changes: StatsCards is
  // only ever mounted while `stats` is already loaded (DashboardScreen swaps
  // in an ActivityIndicator during isLoadingStats instead of keeping this
  // component alive), so a new event selection always remounts this
  // component fresh rather than carrying the old cycle position forward.
  const [rsvpCycleIndex, setRsvpCycleIndex] = useState(0);
  const rsvpView = RSVP_CYCLE[rsvpCycleIndex];
  const handleRsvpTap = () => setRsvpCycleIndex((i) => (i + 1) % RSVP_CYCLE.length);

  // DIP-FP-197-mobile: Announcement events return only `announcement`
  // (attendance/rsvp/rating omitted entirely — confirmed live against web's
  // report.repository.ts) — a single card instead of the usual three. This
  // early return happens after both hooks above are already called
  // unconditionally, so it doesn't violate the Rules of Hooks even though
  // DashboardStats' fields are all independently optional on the type.
  if (stats.announcement) {
    const announcement = stats.announcement;
    const announcementColor =
      announcement.percent !== null ? rateBandColor(colors, announcement.percent / 100) : colors.textMuted;
    const announcementMax = Math.max(announcement.acknowledged_count, announcement.not_acknowledged_count);

    return (
      <View style={styles.cards}>
        <View style={[styles.card, { borderColor: announcementColor + "44" }]}>
          <View style={[styles.cardHeaderBar, { backgroundColor: announcementColor }]}>
            <Text style={styles.cardHeaderText}>Acknowledgement</Text>
          </View>
          <View style={[styles.cardBody, { backgroundColor: announcementColor + "1a" }]}>
            <Text style={[styles.cardStat, { color: announcementColor }]}>
              {announcement.percent !== null ? `${announcement.percent}%` : "—"}
            </Text>
            <View style={styles.barList}>
              <BarRow
                label="Acknowledged"
                count={announcement.acknowledged_count}
                max={announcementMax}
                color={colors.success}
              />
              <BarRow
                label="Not Acknowledged"
                count={announcement.not_acknowledged_count}
                max={announcementMax}
                color={colors.danger}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Not an Announcement event, so attendance/rsvp/rating are guaranteed
  // present together (confirmed live — web only ever omits them as a group,
  // in exchange for `announcement`, never partially). Non-null-asserted
  // once here rather than at every call site below, same convention already
  // used elsewhere in this codebase (e.g. create.tsx's startDatetime!).
  const attendance = stats.attendance!;
  const rsvp = stats.rsvp!;
  const rating = stats.rating!;

  const attendancePercent = attendance.percent;
  const attendanceColor =
    attendancePercent !== null ? rateBandColor(colors, attendancePercent / 100) : colors.textMuted;

  const rsvpTotal = rsvp.yes_count + rsvp.no_count + rsvp.tentative_count + rsvp.no_response_count;
  const rsvpRate = rsvpTotal > 0 ? rsvp.yes_count / rsvpTotal : 0;
  const rsvpColor = rsvpTotal > 0 ? rateBandColor(colors, rsvpRate) : colors.textMuted;

  const ratingColor = ratingBandColor(colors, rating.rounded);

  const attendanceMax = Math.max(
    attendance.attended_count,
    attendance.did_not_attend_count,
    attendance.did_not_self_report_count
  );

  const rsvpMax = Math.max(rsvp.yes_count, rsvp.no_count, rsvp.tentative_count, rsvp.no_response_count);

  const breakdownByStar = new Map(rating.breakdown.map((entry) => [entry.star, entry.count]));
  const ratingMax = Math.max(0, ...STAR_ORDER.map((star) => breakdownByStar.get(star) ?? 0));

  return (
    <View style={styles.cards}>
      <View style={[styles.card, { borderColor: attendanceColor + "44" }]}>
        <View style={[styles.cardHeaderBar, { backgroundColor: attendanceColor }]}>
          <Text style={styles.cardHeaderText}>Attendance</Text>
        </View>
        <View style={[styles.cardBody, { backgroundColor: attendanceColor + "1a" }]}>
          <Text style={[styles.cardStat, { color: attendanceColor }]}>
            {attendancePercent !== null ? `${attendancePercent}%` : "—"}
          </Text>
          <Text style={[styles.cardMeta, themed.cardMeta]}>Expected: {attendance.expected_count}</Text>
          <View style={styles.barList}>
            <BarRow label="Attended" count={attendance.attended_count} max={attendanceMax} color={colors.success} />
            <BarRow
              label="Did Not Attend"
              count={attendance.did_not_attend_count}
              max={attendanceMax}
              color={colors.danger}
            />
            <BarRow
              label="Did Not Self-Report"
              count={attendance.did_not_self_report_count}
              max={attendanceMax}
              color={colors.warning}
            />
          </View>
        </View>
      </View>

      <View style={[styles.card, { borderColor: rsvpColor + "44" }]}>
        <View style={[styles.cardHeaderBar, { backgroundColor: rsvpColor }]}>
          <Text style={styles.cardHeaderText}>RSVP</Text>
        </View>
        <View style={[styles.cardBody, { backgroundColor: rsvpColor + "1a" }]}>
          {/* DIP-FP-182-mobile-adj-3: tappable, cycles through five views —
              color stays fixed to rsvpColor throughout (only the number/
              label changes), and resets to Accepted on remount (see
              rsvpCycleIndex's own comment above). */}
          <Pressable onPress={handleRsvpTap} testID="dashboard-rsvp-cycle">
            <Text style={[styles.cardStat, { color: rsvpColor }]}>{rsvpHeadline(rsvpView, rsvp)}</Text>
          </Pressable>
          <View style={styles.barList}>
            <BarRow label="Accepted" count={rsvp.yes_count} max={rsvpMax} color={colors.success} />
            <BarRow label="Declined" count={rsvp.no_count} max={rsvpMax} color={colors.danger} />
            <BarRow label="Tentative" count={rsvp.tentative_count} max={rsvpMax} color={colors.warning} />
            <BarRow label="Did Not Respond" count={rsvp.no_response_count} max={rsvpMax} color={colors.textMuted} />
          </View>
        </View>
      </View>

      <View style={[styles.card, { borderColor: ratingColor + "44" }]}>
        <View style={[styles.cardHeaderBar, { backgroundColor: ratingColor }]}>
          <Text style={styles.cardHeaderText}>Rating & Feedback</Text>
        </View>
        <View style={[styles.cardBody, { backgroundColor: ratingColor + "1a" }]}>
          <Text style={[styles.cardStat, { color: ratingColor }]}>
            {rating.average !== null ? rating.average.toFixed(1) : "—"}
          </Text>
          <Text style={[styles.cardMeta, themed.cardMeta]}>
            {rating.rating_count} rating{rating.rating_count === 1 ? "" : "s"}
          </Text>
          <View style={styles.barList}>
            {STAR_ORDER.map((star) => (
              <BarRow
                key={star}
                label={`${star}★`}
                count={breakdownByStar.get(star) ?? 0}
                max={ratingMax}
                color={starBarColor(colors, star)}
              />
            ))}
          </View>
          {rating.feedback.length > 0 ? (
            <View style={styles.feedbackList}>
              {rating.feedback.map((entry, index) => (
                <View key={index} style={styles.feedbackRow}>
                  {entry.star_rating !== null ? (
                    // DIP-FP-182-mobile-adj-4: same starBarColor() call as
                    // the Rating card's bar rows above, not a second
                    // hardcoded color list — guarantees this can't drift out
                    // of sync with the bar-row colors.
                    <Text style={[styles.cardMeta, { color: starBarColor(colors, entry.star_rating) }]}>
                      {"★".repeat(entry.star_rating)}
                    </Text>
                  ) : null}
                  <Text style={[styles.feedbackText, themed.feedbackText]}>{`"${entry.feedback}"`}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.feedbackEmpty, themed.feedbackEmpty]}>No feedback submitted yet.</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyEvents, setHasAnyEvents] = useState(true);

  const [eventTypes, setEventTypes] = useState<DashboardEventType[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<DashboardEventType | null>(null);

  const [events, setEvents] = useState<DashboardEventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DashboardEventOption | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // FP-206-adj-2: extracted out of the mount-only useEffect below so Retry
  // can re-invoke this same bootstrap when the very first load (before any
  // event type/event was ever selected) is what failed — see handleRetry's
  // dispatch logic. isMountedRef preserves the original inline version's
  // unmount-guard (a component-unmounted-mid-fetch race can't set state on
  // an unmounted screen), just moved from a useEffect-local `isCancelled`
  // closure to a ref so this can be called from outside that effect too.
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [defaultDashboard, types] = await Promise.all([getDefaultDashboard(), listEventTypes()]);
      if (!isMountedRef.current) return;

      setEventTypes(types);

      if (defaultDashboard === null) {
        setHasAnyEvents(false);
        return;
      }

      setHasAnyEvents(true);
      setSelectedEventType(defaultDashboard.event_type);
      setSelectedEvent(defaultDashboard.event);

      // getDefaultDashboard() doesn't bundle stats (see DefaultDashboardEvent
      // in types.ts) — fetched alongside the Event dropdown's own options.
      const [typeEvents, initialStats] = await Promise.all([
        listEventsForType(defaultDashboard.event_type.id),
        getDashboardStats(defaultDashboard.event.id),
      ]);
      if (!isMountedRef.current) return;
      setEvents(typeEvents);
      setStats(initialStats);
    } catch (err) {
      if (isMountedRef.current) setError(err instanceof Error ? err.message : "Failed to load the dashboard.");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSelectEventType = async (eventType: DashboardEventType) => {
    setSelectedEventType(eventType);
    setSelectedEvent(null);
    setStats(null);
    setError(null);
    setIsLoadingEvents(true);
    try {
      const typeEvents = await listEventsForType(eventType.id);
      setEvents(typeEvents);
      const first = typeEvents[0] ?? null;
      setSelectedEvent(first);
      if (first) {
        setIsLoadingStats(true);
        const nextStats = await getDashboardStats(first.id);
        setStats(nextStats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events for that type.");
    } finally {
      setIsLoadingEvents(false);
      setIsLoadingStats(false);
    }
  };

  const handleSelectEvent = async (event: DashboardEventOption) => {
    setSelectedEvent(event);
    setError(null);
    setIsLoadingStats(true);
    try {
      const nextStats = await getDashboardStats(event.id);
      setStats(nextStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats for that event.");
    } finally {
      setIsLoadingStats(false);
    }
  };

  // FP-206-adj-2: unlike the other three tab screens, this one has three
  // distinct places `error` can come from (the initial bootstrap, an event
  // type change, an event change), and selection state alone can't tell them
  // apart — loadDashboard sets selectedEventType/selectedEvent *before*
  // fetching that type's event list and stats, so a failure partway through
  // it still leaves both "selected" even though `events` was never
  // populated. Checking what actually loaded (eventTypes/events, not just
  // what's selected) picks the retry that will actually repair the gap:
  // - eventTypes never loaded at all -> the initial bootstrap itself failed.
  // - a type is selected but its event list never loaded -> re-run the
  //   type-change fetch (also covers loadDashboard's own second phase
  //   failing after it already set selectedEventType/selectedEvent).
  // - the event list loaded fine and an event is selected -> only that
  //   event's stats need retrying.
  const handleRetry = () => {
    if (eventTypes.length === 0) {
      loadDashboard();
    } else if (selectedEventType && events.length === 0) {
      handleSelectEventType(selectedEventType);
    } else if (selectedEvent) {
      handleSelectEvent(selectedEvent);
    } else {
      loadDashboard();
    }
  };

  // DIP-FP-194-mobile: this screen has three separate top-level return
  // points (unlike the other four tab screens, which each have one return
  // with internal ternary branches) — all three get wrapped, not just the
  // main one, so swipe still works while the dashboard is loading or empty
  // rather than only once content has loaded.
  if (isLoading) {
    return (
      <SwipeableTabScreen>
      <View style={[styles.container, themed.container, styles.center]}>
        <ActivityIndicator />
      </View>
      </SwipeableTabScreen>
    );
  }

  if (!hasAnyEvents) {
    return (
      <SwipeableTabScreen>
      <View style={[styles.container, themed.container, styles.center]}>
        <Text style={themed.empty}>No events to show yet.</Text>
      </View>
      </SwipeableTabScreen>
    );
  }

  return (
    <SwipeableTabScreen>
    <ScrollView style={[styles.container, themed.container]} contentContainerStyle={styles.content}>
      {error ? (
        <View style={styles.errorRow}>
          <Text style={[styles.error, themed.error]}>{error}</Text>
          <Pressable style={[styles.retryButton, themed.retryButton]} onPress={handleRetry} testID="dashboard-retry">
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : null}

      {/* DIP-FP-182-mobile-adj-3: one shared heading replaces the "Event
          Type" field label entirely; the "Event" field's own label is
          dropped too (stacking "Events" directly above "Event" would read
          as redundant) — the fixed type-then-event order and each field's
          placeholder/value text stay self-explanatory without individual
          labels. Each field's Modal sheet keeps its own distinct title via
          modalTitle, so the picker itself isn't ambiguous either. */}
      <Text style={[styles.sectionHeading, themed.sectionHeading]}>Events</Text>

      <DropdownField
        label=""
        modalTitle="Event Type"
        value={selectedEventType}
        options={eventTypes}
        keyExtractor={(item) => item.id}
        renderLabel={(item) => item.name}
        onSelect={handleSelectEventType}
        themed={themed}
        testID="dashboard-event-type"
      />

      <DropdownField
        label=""
        modalTitle="Event"
        value={selectedEvent}
        options={events}
        keyExtractor={(item) => item.id}
        renderLabel={formatEventOptionLabel}
        onSelect={handleSelectEvent}
        themed={themed}
        testID="dashboard-event"
      />

      {isLoadingEvents || isLoadingStats ? (
        <ActivityIndicator style={styles.cardsLoading} />
      ) : stats ? (
        <StatsCards stats={stats} themed={themed} />
      ) : null}
    </ScrollView>
    </SwipeableTabScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  error: {
    flex: 1,
  },
  retryButton: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  doneText: {
    fontSize: 15,
    fontWeight: "600",
  },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 15,
  },
  cardsLoading: {
    marginTop: 24,
  },
  cards: {
    gap: 12,
    marginTop: 8,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  // DIP-FP-182-mobile-adj-3: the title used to be plain colored text inside
  // `card`'s own padding; it now sits on its own full-strength-color strip
  // above the (still pale-tinted) body — `card` lost its padding/background
  // so this bar can run edge-to-edge and get clipped to the card's own
  // rounded corners via `overflow: hidden` above.
  cardHeaderBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  cardBody: {
    padding: 16,
  },
  cardStat: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 4,
  },
  cardMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  barList: {
    marginTop: 12,
    gap: 8,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    width: 132,
    fontSize: 12,
    fontWeight: "600",
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  feedbackList: {
    marginTop: 12,
    gap: 10,
  },
  feedbackRow: {
    gap: 2,
    // ~3 character-widths at this font size — a fixed padding indents
    // predictably regardless of font, unlike literal leading spaces in a
    // proportional font (per this DIP's own Grounding Check).
    paddingLeft: 24,
  },
  feedbackText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  feedbackEmpty: {
    fontSize: 13,
    marginTop: 8,
  },
});
