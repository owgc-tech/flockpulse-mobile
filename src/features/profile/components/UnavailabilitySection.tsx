import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Plus, Trash2 } from "lucide-react-native";
import {
  addUnavailabilityRange,
  deleteUnavailabilityRange,
  listMyUnavailability,
  type UnavailabilityRange,
} from "@/src/features/members/unavailability.service";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatRangeLabel(range: UnavailabilityRange): string {
  const fmt = (dateOnly: string) =>
    new Date(`${dateOnly}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(range.start_date)} – ${fmt(range.end_date)}`;
}

// DIP-FP-190-mobile: overlaps the current calendar year — filing itself is
// never restricted to this window (listMyUnavailability() returns
// everything a member has ever filed), only this view. "YYYY-MM-DD" string
// comparison is lexicographically valid date comparison, same as the raw
// dates elsewhere in this app (e.g. rsvp_closure_at-adjacent code).
function isInCurrentYear(range: UnavailabilityRange): boolean {
  const year = new Date().getFullYear();
  return range.start_date <= `${year}-12-31` && range.end_date >= `${year}-01-01`;
}

// Fixed width of the delete affordance revealed behind a swiped-left row —
// also the open/closed snap target, not just a visual width.
const SWIPE_REVEAL_WIDTH = 72;

// Same activation/fail offsets as SwipeableTabScreen.tsx, so a horizontal
// swipe on a row doesn't fight this screen's own vertical ScrollView.
const HORIZONTAL_ACTIVATION_OFFSET = 20;
const VERTICAL_FAIL_OFFSET = 20;

function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    inputText: { color: colors.text },
    placeholderText: { color: colors.textMuted },
    empty: { color: colors.textSecondary },
    error: { color: colors.danger },
    addButton: { backgroundColor: colors.accent },
    confirmButton: { backgroundColor: colors.accent },
    list: { borderColor: colors.border },
    rowBorder: { borderBottomColor: colors.border },
    rowContent: { backgroundColor: colors.background },
    rangeText: { color: colors.text },
    deleteAction: { backgroundColor: colors.danger },
  });
}

interface UnavailabilityRowProps {
  range: UnavailabilityRange;
  themed: ReturnType<typeof getThemedStyles>;
  onDelete: (id: string) => void;
}

// DIP-FP-190-mobile: reveal-only, not a full swipe-to-dismiss — mirrors
// SwipeableTabScreen.tsx's activeOffsetX/failOffsetY disambiguation (a Pan
// gesture only activates past activeOffsetX horizontally, yielding to
// vertical scrolling if it crosses failOffsetY first), but this gesture
// only ever snaps between 0 (closed) and -SWIPE_REVEAL_WIDTH (open) rather
// than driving navigation. The actual delete only fires on a separate tap
// of the revealed affordance — the swipe itself never deletes anything.
function UnavailabilityRow({ range, themed, onDelete }: UnavailabilityRowProps) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-HORIZONTAL_ACTIVATION_OFFSET, HORIZONTAL_ACTIVATION_OFFSET])
    .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = Math.min(0, Math.max(-SWIPE_REVEAL_WIDTH, startX.value + event.translationX));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -SWIPE_REVEAL_WIDTH / 2;
      translateX.value = withSpring(shouldOpen ? -SWIPE_REVEAL_WIDTH : 0);
    });

  return (
    <View style={[styles.rowWrapper, themed.rowBorder]}>
      <Pressable
        style={[styles.deleteAction, themed.deleteAction]}
        onPress={() => onDelete(range.id)}
        testID={`unavailability-delete-${range.id}`}
      >
        <Trash2 size={20} color="#fff" />
      </Pressable>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.rowContent, themed.rowContent, animatedStyle]}>
          <Text style={[styles.rangeText, themed.rangeText]} testID={`unavailability-range-${range.id}`}>
            {formatRangeLabel(range)}
          </Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// DIP-FP-190-mobile: add/delete are each their own immediate API call, not
// batched with EditProfileScreen's Save button — this section owns its own
// load/error state entirely independent of the surrounding form.
export function UnavailabilitySection() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);

  const [ranges, setRanges] = useState<UnavailabilityRange[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showIosPicker, setShowIosPicker] = useState<"start" | "end" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const all = await listMyUnavailability();
      setRanges(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load unavailability.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRanges = useMemo(
    () => ranges.filter(isInCurrentYear).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [ranges]
  );

  const handlePressDate = (field: "start" | "end") => {
    const value = (field === "start" ? startDate : endDate) ?? new Date();
    const setValue = field === "start" ? setStartDate : setEndDate;
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            setValue(selectedDate);
          }
        },
      });
    } else {
      setShowIosPicker(field);
    }
  };

  const handleConfirmAdd = async () => {
    if (!startDate || !endDate) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const created = await addUnavailabilityRange(toDateOnlyString(startDate), toDateOnlyString(endDate));
      setRanges((prev) => [...prev, created]);
      setIsAdding(false);
      setStartDate(null);
      setEndDate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add unavailability range.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setStartDate(null);
    setEndDate(null);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteUnavailabilityRange(id);
      setRanges((prev) => prev.filter((range) => range.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete unavailability range.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, themed.label]}>Not available on these Dates</Text>
        <Pressable
          style={[styles.addButton, themed.addButton]}
          onPress={() => setIsAdding(true)}
          testID="unavailability-add-button"
        >
          <Plus size={18} color="#fff" />
        </Pressable>
      </View>

      {isAdding ? (
        <View style={styles.addForm}>
          <Text style={[styles.fieldLabel, themed.label]}>From</Text>
          <Pressable
            style={[styles.input, themed.input]}
            onPress={() => handlePressDate("start")}
            testID="unavailability-start-date"
          >
            <Text style={startDate ? themed.inputText : themed.placeholderText}>
              {startDate ? startDate.toLocaleDateString() : "Select date"}
            </Text>
          </Pressable>
          {Platform.OS === "ios" && showIosPicker === "start" ? (
            <DateTimePicker
              value={startDate ?? new Date()}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(event, selectedDate) => {
                setShowIosPicker(null);
                if (event.type === "set" && selectedDate) setStartDate(selectedDate);
              }}
            />
          ) : null}

          <Text style={[styles.fieldLabel, themed.label]}>To</Text>
          <Pressable
            style={[styles.input, themed.input]}
            onPress={() => handlePressDate("end")}
            testID="unavailability-end-date"
          >
            <Text style={endDate ? themed.inputText : themed.placeholderText}>
              {endDate ? endDate.toLocaleDateString() : "Select date"}
            </Text>
          </Pressable>
          {Platform.OS === "ios" && showIosPicker === "end" ? (
            <DateTimePicker
              value={endDate ?? new Date()}
              mode="date"
              display="spinner"
              themeVariant="light"
              onChange={(event, selectedDate) => {
                setShowIosPicker(null);
                if (event.type === "set" && selectedDate) setEndDate(selectedDate);
              }}
            />
          ) : null}

          <View style={styles.addFormActions}>
            <Pressable onPress={handleCancelAdd} disabled={isSubmitting} testID="unavailability-cancel">
              <Text style={[styles.cancelText, themed.label]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmButton,
                themed.confirmButton,
                (!startDate || !endDate || isSubmitting) && styles.buttonDisabled,
              ]}
              onPress={handleConfirmAdd}
              disabled={!startDate || !endDate || isSubmitting}
              testID="unavailability-confirm"
            >
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Add</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, themed.error]} testID="unavailability-error">
          {error}
        </Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : visibleRanges.length > 0 ? (
        <View style={[styles.list, themed.list]}>
          {visibleRanges.map((range) => (
            <UnavailabilityRow key={range.id} range={range} themed={themed} onDelete={handleDelete} />
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, themed.empty]}>No dates filed for this year.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addForm: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  addFormActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 16,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  error: {
    fontSize: 13,
    marginTop: 12,
  },
  loading: {
    marginTop: 16,
  },
  empty: {
    fontSize: 14,
    marginTop: 12,
  },
  list: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  rowWrapper: {
    position: "relative",
    overflow: "hidden",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_REVEAL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rangeText: {
    fontSize: 15,
  },
});
