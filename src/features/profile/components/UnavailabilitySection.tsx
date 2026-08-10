import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Pencil, Plus, Trash2 } from "lucide-react-native";
import {
  addUnavailabilityRange,
  deleteUnavailabilityRange,
  listMyUnavailability,
  updateUnavailabilityRange,
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

// DIP-FP-190-mobile-adj-1: generous gap deliberately requested to prevent
// mis-taps between the two permanently-visible icon buttons, on top of
// each one's own hitSlop below.
const ROW_ACTIONS_GAP = 24;
const ICON_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 };

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
    rangeText: { color: colors.text },
  });
}

interface UnavailabilityRowProps {
  range: UnavailabilityRange;
  themed: ReturnType<typeof getThemedStyles>;
  colors: ThemeColors;
  onEdit: (range: UnavailabilityRange) => void;
  onDelete: (id: string) => void;
}

// DIP-FP-190-mobile-adj-1: swipe-to-reveal removed entirely — both actions
// are now permanently visible, plain icon Pressables, no gesture-handler/
// reanimated involvement in this row at all.
function UnavailabilityRow({ range, themed, colors, onEdit, onDelete }: UnavailabilityRowProps) {
  return (
    <View style={[styles.rowWrapper, themed.rowBorder]}>
      <Text style={[styles.rangeText, themed.rangeText]} numberOfLines={1} testID={`unavailability-range-${range.id}`}>
        {formatRangeLabel(range)}
      </Text>
      <View style={styles.rowActions}>
        <Pressable onPress={() => onEdit(range)} hitSlop={ICON_HIT_SLOP} testID={`unavailability-edit-${range.id}`}>
          <Pencil size={18} color={colors.accent} />
        </Pressable>
        <Pressable
          onPress={() => onDelete(range.id)}
          hitSlop={ICON_HIT_SLOP}
          testID={`unavailability-delete-${range.id}`}
        >
          <Trash2 size={18} color={colors.danger} />
        </Pressable>
      </View>
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

  // DIP-FP-190-mobile-adj-1: the same from/to form now serves both add and
  // edit — editingId null means "add," non-null means "edit that range,"
  // rather than two separate form implementations.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const handleOpenAdd = () => {
    setEditingId(null);
    setStartDate(null);
    setEndDate(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (range: UnavailabilityRange) => {
    setEditingId(range.id);
    setStartDate(new Date(`${range.start_date}T00:00:00`));
    setEndDate(new Date(`${range.end_date}T00:00:00`));
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setStartDate(null);
    setEndDate(null);
    setError(null);
  };

  const handleConfirmForm = async () => {
    if (!startDate || !endDate) return;
    setError(null);
    setIsSubmitting(true);
    try {
      if (editingId) {
        const updated = await updateUnavailabilityRange(editingId, toDateOnlyString(startDate), toDateOnlyString(endDate));
        setRanges((prev) => prev.map((range) => (range.id === editingId ? updated : range)));
      } else {
        const created = await addUnavailabilityRange(toDateOnlyString(startDate), toDateOnlyString(endDate));
        setRanges((prev) => [...prev, created]);
      }
      handleCloseForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${editingId ? "update" : "add"} unavailability range.`
      );
    } finally {
      setIsSubmitting(false);
    }
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
          onPress={handleOpenAdd}
          testID="unavailability-add-button"
        >
          <Plus size={18} color="#fff" />
        </Pressable>
      </View>

      {isFormOpen ? (
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
          {/* DIP-FP-190-mobile-adj-1: inline (calendar grid), not spinner —
              matches Android's look. Confirmed against the installed
              @react-native-community/datetimepicker@9.1.0 types: IOSDisplay
              includes 'inline'. */}
          {Platform.OS === "ios" && showIosPicker === "start" ? (
            <DateTimePicker
              value={startDate ?? new Date()}
              mode="date"
              display="inline"
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
              display="inline"
              themeVariant="light"
              onChange={(event, selectedDate) => {
                setShowIosPicker(null);
                if (event.type === "set" && selectedDate) setEndDate(selectedDate);
              }}
            />
          ) : null}

          <View style={styles.addFormActions}>
            <Pressable onPress={handleCloseForm} disabled={isSubmitting} testID="unavailability-cancel">
              <Text style={[styles.cancelText, themed.label]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmButton,
                themed.confirmButton,
                (!startDate || !endDate || isSubmitting) && styles.buttonDisabled,
              ]}
              onPress={handleConfirmForm}
              disabled={!startDate || !endDate || isSubmitting}
              testID="unavailability-confirm"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>{editingId ? "Save" : "Add"}</Text>
              )}
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
            <UnavailabilityRow
              key={range.id}
              range={range}
              themed={themed}
              colors={colors}
              onEdit={handleOpenEdit}
              onDelete={handleDelete}
            />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeText: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: ROW_ACTIONS_GAP,
  },
});
