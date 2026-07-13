import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "@/src/lib/api";

// GET /api/groups / GET /api/members response rows — confirmed live against
// the route handlers. Only the fields this picker actually displays are
// typed here; not exported, since this is the only consumer of either
// endpoint in this DIP (a dedicated groups/members service file would be a
// single-call-site abstraction — see PR notes).
interface GroupOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  first_name: string;
  last_name: string;
}

export interface TargetSelection {
  group_ids: string[];
  member_ids: string[];
}

interface MemberGroupPickerProps {
  label: string;
  value: TargetSelection;
  onChange: (next: TargetSelection) => void;
  // Prayer-leader usage sets allowGroups=false, singleMember=true — "a
  // single-member variant of the same picker" per the DIP, not a separate
  // component.
  allowGroups?: boolean;
  singleMember?: boolean;
}

function summarize(value: TargetSelection): string {
  const count = value.group_ids.length + value.member_ids.length;
  return count === 0 ? "Select..." : `${count} selected`;
}

export function MemberGroupPicker({
  label,
  value,
  onChange,
  allowGroups = true,
  singleMember = false,
}: MemberGroupPickerProps) {
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
      allowGroups ? apiFetch<GroupOption[]>("/api/groups") : Promise.resolve([]),
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
  }, [isOpen, allowGroups]);

  const toggleGroup = (id: string) => {
    onChange({
      ...value,
      group_ids: value.group_ids.includes(id)
        ? value.group_ids.filter((g) => g !== id)
        : [...value.group_ids, id],
    });
  };

  const toggleMember = (id: string) => {
    if (singleMember) {
      // Selecting the same person again clears it; selecting anyone else
      // replaces the single selection outright.
      onChange({ group_ids: [], member_ids: value.member_ids.includes(id) ? [] : [id] });
      setIsOpen(false);
      return;
    }
    onChange({
      ...value,
      member_ids: value.member_ids.includes(id)
        ? value.member_ids.filter((m) => m !== id)
        : [...value.member_ids, id],
    });
  };

  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(filter.toLowerCase()));
  const filteredMembers = members.filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(filter.toLowerCase())
  );

  type OptionRow = { kind: "group" | "member"; id: string; label: string };
  const rows: OptionRow[] = [
    ...(allowGroups && !singleMember
      ? filteredGroups.map((g) => ({ kind: "group" as const, id: g.id, label: g.name }))
      : []),
    ...filteredMembers.map((m) => ({
      kind: "member" as const,
      id: m.id,
      label: `${m.first_name} ${m.last_name}`,
    })),
  ];

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setIsOpen(true)} testID={`picker-open-${label}`}>
        <Text>{summarize(value)}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable onPress={() => setIsOpen(false)} testID="picker-done">
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={filter}
            onChangeText={setFilter}
            testID="picker-search"
          />

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item) => `${item.kind}-${item.id}`}
              renderItem={({ item }) => {
                const selected =
                  item.kind === "group" ? value.group_ids.includes(item.id) : value.member_ids.includes(item.id);
                return (
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => (item.kind === "group" ? toggleGroup(item.id) : toggleMember(item.id))}
                    testID={`picker-option-${item.kind}-${item.id}`}
                  >
                    <Text style={styles.optionLabel}>
                      {item.label}
                      {item.kind === "group" ? " (Group)" : ""}
                    </Text>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
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
  check: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 16,
  },
});
