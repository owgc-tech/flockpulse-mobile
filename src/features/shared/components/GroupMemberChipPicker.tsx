import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "@/src/lib/api";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";
import type { TargetSelection } from "@/src/features/shared/components/MemberGroupPicker";

// GET /api/groups / GET /api/members response rows — same "only what this
// consumer uses" convention as MemberGroupPicker's own copy of these
// interfaces (kept local, not shared, since this is the only other
// consumer of either endpoint).
interface GroupOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

interface GroupMemberChipPickerProps {
  label: string;
  value: TargetSelection;
  onChange: (next: TargetSelection) => void;
  // DIP-FP-162-picker-component: excludes groups from results and chips
  // entirely (search and select individuals only) — built now, unused
  // until FP-163 wires it up to an actual individual-only call site.
  individualOnly?: boolean;
  // DIP-FP-214-mobile: when true, the collapsed trigger gets a red border,
  // matching the blank-required-field highlighting on the Create/Edit Event
  // screens. Optional — the task pickers that also consume this component
  // never pass it.
  invalid?: boolean;
}

type Chip = { kind: "group" | "member"; id: string; label: string };
type ResultRow =
  | { kind: "divider" }
  | { kind: "group"; id: string; label: string }
  | { kind: "member"; id: string; label: string };

function byLabel(a: { label: string }, b: { label: string }): number {
  return a.label.localeCompare(b.label);
}

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays, same
// convention as MemberGroupPicker and every other themed component in this
// app.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    inputText: { color: colors.text },
    modalContainer: { backgroundColor: colors.background },
    modalTitle: { color: colors.text },
    doneText: { color: colors.accent },
    searchInput: { borderColor: colors.border, color: colors.text },
    chip: { backgroundColor: colors.backgroundSecondary },
    chipText: { color: colors.text },
    chipRemove: { color: colors.textSecondary },
    dividerLabel: { color: colors.textSecondary, borderTopColor: colors.divider },
    optionRow: { borderBottomColor: colors.border },
    optionLabel: { color: colors.text },
    emptyText: { color: colors.textSecondary },
    error: { color: colors.danger },
    invalidInput: { borderColor: colors.danger, borderWidth: 1.5 },
  });
}

export function GroupMemberChipPicker({
  label,
  value,
  onChange,
  individualOnly = false,
  invalid = false,
}: GroupMemberChipPickerProps) {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(false);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsLoading(true);
    Promise.all([
      individualOnly ? Promise.resolve([]) : apiFetch<GroupOption[]>("/api/groups"),
      apiFetch<MemberOption[]>("/api/members"),
    ])
      .then(([groupData, memberData]) => {
        setGroups(groupData);
        setMembers(memberData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load options.");
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, individualOnly]);

  const addGroup = (id: string) => onChange({ ...value, group_ids: [...value.group_ids, id] });
  const addMember = (id: string) => onChange({ ...value, member_ids: [...value.member_ids, id] });
  const removeGroup = (id: string) => onChange({ ...value, group_ids: value.group_ids.filter((g) => g !== id) });
  const removeMember = (id: string) => onChange({ ...value, member_ids: value.member_ids.filter((m) => m !== id) });

  // Selected chips, resolved from the fetched catalogs — an id whose
  // catalog entry hasn't loaded yet (e.g. the modal just opened) simply
  // doesn't render a chip until it resolves, same non-fatal "nothing until
  // it resolves" convention used elsewhere in this app for id-only fields.
  const selectedChips: Chip[] = [
    ...(individualOnly
      ? []
      : value.group_ids
          .map((id) => groups.find((g) => g.id === id))
          .filter((g): g is GroupOption => Boolean(g))
          .map((g) => ({ kind: "group" as const, id: g.id, label: g.name }))),
    ...value.member_ids
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is MemberOption => Boolean(m))
      .map((m) => ({ kind: "member" as const, id: m.id, label: `${m.first_name} ${m.last_name}` })),
  ];

  // Results exclude already-selected items — selecting one removes it from
  // further results (per the DIP) rather than leaving it toggleable in
  // place. Merged, alphabetically-sorted groups (A-Z) then a divider then
  // individuals (A-Z), filtered live by the search text.
  const filteredGroups = individualOnly
    ? []
    : groups
        .filter((g) => !value.group_ids.includes(g.id))
        .filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()))
        .map((g) => ({ id: g.id, label: g.name }))
        .sort(byLabel);

  const filteredMembers = members
    .filter((m) => !value.member_ids.includes(m.id))
    .filter((m) => `${m.first_name} ${m.last_name}`.toLowerCase().includes(filter.toLowerCase()))
    .map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name}` }))
    .sort(byLabel);

  const resultRows: ResultRow[] = [
    ...filteredGroups.map((g) => ({ kind: "group" as const, id: g.id, label: g.label })),
    ...(filteredGroups.length > 0 && filteredMembers.length > 0 ? [{ kind: "divider" as const }] : []),
    ...filteredMembers.map((m) => ({ kind: "member" as const, id: m.id, label: m.label })),
  ];

  const selectedCount = value.group_ids.length + value.member_ids.length;

  return (
    <View>
      <Text style={[styles.label, themed.label]}>{label}</Text>
      <Pressable
        style={[styles.input, themed.input, invalid && themed.invalidInput]}
        onPress={() => setIsOpen(true)}
        testID={`picker-open-${label}`}
      >
        <Text style={themed.inputText}>{selectedCount === 0 ? "Select..." : `${selectedCount} selected`}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.modalContainer, themed.modalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, themed.modalTitle]}>{label}</Text>
            <Pressable onPress={() => setIsOpen(false)} testID="picker-done">
              <Text style={[styles.doneText, themed.doneText]}>Done</Text>
            </Pressable>
          </View>

          {selectedChips.length > 0 ? (
            <View style={styles.chipRow}>
              {selectedChips.map((chip) => (
                <Pressable
                  key={`${chip.kind}-${chip.id}`}
                  style={[styles.chip, themed.chip]}
                  onPress={() => (chip.kind === "group" ? removeGroup(chip.id) : removeMember(chip.id))}
                  testID={`picker-chip-${chip.kind}-${chip.id}`}
                >
                  <Text style={[styles.chipText, themed.chipText]}>
                    {chip.label}
                    {chip.kind === "group" ? " (Group)" : ""}
                  </Text>
                  <Text style={[styles.chipRemove, themed.chipRemove]}> ✕</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextInput
            style={[styles.searchInput, themed.searchInput]}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            value={filter}
            onChangeText={setFilter}
            testID="picker-search"
          />

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={[styles.error, themed.error]}>{error}</Text>
          ) : (
            <FlatList
              data={resultRows}
              keyExtractor={(item, index) => (item.kind === "divider" ? `divider-${index}` : `${item.kind}-${item.id}`)}
              renderItem={({ item }) =>
                item.kind === "divider" ? (
                  <Text style={[styles.dividerLabel, themed.dividerLabel]}>Individuals</Text>
                ) : (
                  <Pressable
                    style={[styles.optionRow, themed.optionRow]}
                    onPress={() => (item.kind === "group" ? addGroup(item.id) : addMember(item.id))}
                    testID={`picker-option-${item.kind}-${item.id}`}
                  >
                    <Text style={[styles.optionLabel, themed.optionLabel]}>
                      {item.label}
                      {item.kind === "group" ? " (Group)" : ""}
                    </Text>
                  </Pressable>
                )
              }
              ListEmptyComponent={<Text style={[styles.emptyText, themed.emptyText]}>No results</Text>}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 48,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  doneText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  chipRemove: {
    fontSize: 13,
  },
  searchInput: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  center: {
    marginTop: 24,
  },
  dividerLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  optionLabel: {
    fontSize: 15,
    color: "#333",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
