import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getDashboardStats,
  getDefaultDashboard,
  listEventsForType,
  listEventTypes,
} from "@/src/features/dashboard/services/dashboard.service";
import type { DashboardEventOption, DashboardStats } from "@/src/features/dashboard/types";
import type { EventType } from "@/src/features/event-types/types";
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

// Bands on the rating rounded to the nearest whole star, deliberately
// separate from the raw average this card displays as text (e.g. a 3.98
// isn't banded any harsher than a 4.01) — see DashboardRatingStats.average_rating.
function ratingBandColor(colors: ThemeColors, averageRating: number | null): string {
  if (averageRating === null) return colors.textMuted;
  const rounded = Math.round(averageRating);
  if (rounded >= 4) return colors.success;
  if (rounded === 3) return colors.warning;
  return colors.danger;
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
    cardTitle: { color: colors.text },
    cardMeta: { color: colors.textSecondary },
    modalContainer: { backgroundColor: colors.background },
    modalTitle: { color: colors.text },
    doneText: { color: colors.accent },
    optionRow: { borderBottomColor: colors.border },
    optionRowSelected: { backgroundColor: colors.backgroundSecondary },
    optionLabel: { color: colors.text },
    optionLabelSelected: { color: colors.accent },
    feedbackName: { color: colors.text },
    feedbackText: { color: colors.textSecondary },
    feedbackEmpty: { color: colors.textMuted },
  });
}

interface DropdownFieldProps<T> {
  label: string;
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
      <Text style={[styles.label, themed.label]}>{label}</Text>
      <Pressable style={[styles.input, themed.input]} onPress={() => setIsOpen(true)} testID={`${testID}-open`}>
        <Text style={value ? themed.inputText : themed.placeholderText}>
          {value ? renderLabel(value) : "Select…"}
        </Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.modalContainer, themed.modalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, themed.modalTitle]}>{label}</Text>
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

function StatsCards({ stats, themed }: { stats: DashboardStats; themed: ReturnType<typeof getThemedStyles> }) {
  const colors = useThemeColors();

  const attendancePct = Math.round(stats.attendance.attendance_rate * 100);
  const attendanceColor = rateBandColor(colors, stats.attendance.attendance_rate);

  const rsvpRate = stats.rsvp.total_invited > 0 ? stats.rsvp.yes_count / stats.rsvp.total_invited : 0;
  const rsvpColor = rateBandColor(colors, rsvpRate);

  const ratingColor = ratingBandColor(colors, stats.rating.average_rating);

  return (
    <View style={styles.cards}>
      <View style={[styles.card, { backgroundColor: attendanceColor + "1a", borderColor: attendanceColor + "44" }]}>
        <Text style={[styles.cardTitle, themed.cardTitle]}>Attendance</Text>
        <Text style={[styles.cardStat, { color: attendanceColor }]}>{attendancePct}%</Text>
        <Text style={[styles.cardMeta, themed.cardMeta]}>
          {stats.attendance.attended_count} of {stats.attendance.expected_count} expected
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: rsvpColor + "1a", borderColor: rsvpColor + "44" }]}>
        <Text style={[styles.cardTitle, themed.cardTitle]}>RSVP</Text>
        <Text style={[styles.cardStat, { color: rsvpColor }]}>{stats.rsvp.yes_count} yes</Text>
        <Text style={[styles.cardMeta, themed.cardMeta]}>
          {stats.rsvp.no_count} no · {stats.rsvp.no_response_count} no response · {stats.rsvp.total_invited} invited
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: ratingColor + "1a", borderColor: ratingColor + "44" }]}>
        <Text style={[styles.cardTitle, themed.cardTitle]}>Rating & Feedback</Text>
        <Text style={[styles.cardStat, { color: ratingColor }]}>
          {stats.rating.average_rating !== null ? stats.rating.average_rating.toFixed(1) : "—"}
        </Text>
        <Text style={[styles.cardMeta, themed.cardMeta]}>
          {stats.rating.feedback.length} feedback submission{stats.rating.feedback.length === 1 ? "" : "s"}
        </Text>
        {stats.rating.feedback.length > 0 ? (
          <View style={styles.feedbackList}>
            {stats.rating.feedback.map((entry, index) => (
              <View key={`${entry.member_name}-${index}`} style={styles.feedbackRow}>
                <Text style={[styles.feedbackName, themed.feedbackName]}>
                  {entry.member_name}
                  {entry.star_rating !== null ? ` — ${entry.star_rating}★` : ""}
                </Text>
                <Text style={[styles.feedbackText, themed.feedbackText]}>{entry.feedback}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.feedbackEmpty, themed.feedbackEmpty]}>No feedback submitted yet.</Text>
        )}
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

  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(null);

  const [events, setEvents] = useState<DashboardEventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DashboardEventOption | null>(null);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [defaultDashboard, types] = await Promise.all([getDefaultDashboard(), listEventTypes()]);
        if (isCancelled) return;

        setEventTypes(types);

        if (defaultDashboard === null) {
          setHasAnyEvents(false);
          return;
        }

        setHasAnyEvents(true);

        const matchingType =
          types.find((t) => t.id === defaultDashboard.event_type_id) ??
          ({ id: defaultDashboard.event_type_id, name: defaultDashboard.event_type_name } as EventType);
        setSelectedEventType(matchingType);

        const typeEvents = await listEventsForType(defaultDashboard.event_type_id);
        if (isCancelled) return;
        setEvents(typeEvents);

        // Falls back to a synthesized option (blank date prefix) only if the
        // default event is somehow missing from its own type's event list —
        // shouldn't happen, but avoids a crash if the two endpoints disagree.
        const matchingEvent =
          typeEvents.find((e) => e.id === defaultDashboard.event_id) ??
          ({
            id: defaultDashboard.event_id,
            name: defaultDashboard.event_name,
            start_datetime: "",
          } as DashboardEventOption);
        setSelectedEvent(matchingEvent);
        setStats(defaultDashboard.stats);
      } catch (err) {
        if (!isCancelled) setError(err instanceof Error ? err.message : "Failed to load the dashboard.");
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSelectEventType = async (eventType: EventType) => {
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

  if (isLoading) {
    return (
      <View style={[styles.container, themed.container, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!hasAnyEvents) {
    return (
      <View style={[styles.container, themed.container, styles.center]}>
        <Text style={themed.empty}>No events to show yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, themed.container]} contentContainerStyle={styles.content}>
      {error ? <Text style={[styles.error, themed.error]}>{error}</Text> : null}

      <DropdownField
        label="Event Type"
        value={selectedEventType}
        options={eventTypes}
        keyExtractor={(item) => item.id}
        renderLabel={(item) => item.name}
        onSelect={handleSelectEventType}
        themed={themed}
        testID="dashboard-event-type"
      />

      <DropdownField
        label="Event"
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
  error: {
    marginBottom: 12,
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
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
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
  feedbackList: {
    marginTop: 12,
    gap: 10,
  },
  feedbackRow: {
    gap: 2,
  },
  feedbackName: {
    fontSize: 13,
    fontWeight: "700",
  },
  feedbackText: {
    fontSize: 13,
  },
  feedbackEmpty: {
    fontSize: 13,
    marginTop: 8,
  },
});
