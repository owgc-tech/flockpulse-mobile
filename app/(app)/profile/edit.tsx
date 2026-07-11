import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fetchMyProfile, updateMyProfile } from "@/src/features/members/services/myProfile.service";
import type { Gender, MaritalStatus, MemberGroup } from "@/src/features/members/types";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

// Full FP-105-widened set, confirmed against the DB constraint — not the
// stale web form's smaller list.
const MARITAL_STATUS_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "SEPARATED", label: "Separated" },
];

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function EditProfileScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatus | null>(null);
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showIosDatePicker, setShowIosDatePicker] = useState(false);
  const [groups, setGroups] = useState<MemberGroup[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const profile = await fetchMyProfile();
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
      setGender(profile.gender);
      setMaritalStatus(profile.marital_status);
      setBirthdate(profile.birthdate ? new Date(profile.birthdate) : null);
      setGroups(profile.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePressBirthdate = () => {
    const value = birthdate ?? new Date();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode: "date",
        maximumDate: new Date(),
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            setBirthdate(selectedDate);
          }
        },
      });
    } else {
      setShowIosDatePicker(true);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(gender ? { gender } : {}),
        ...(maritalStatus ? { maritalStatus } : {}),
        ...(birthdate ? { birthdate: toDateOnlyString(birthdate) } : {}),
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Edit Profile" }} />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: "Edit Profile" }} />

      <Text style={styles.label}>First name</Text>
      <TextInput
        style={styles.input}
        value={firstName}
        onChangeText={setFirstName}
        editable={!isSubmitting}
        testID="edit-first-name"
      />

      <Text style={styles.label}>Last name</Text>
      <TextInput
        style={styles.input}
        value={lastName}
        onChangeText={setLastName}
        editable={!isSubmitting}
        testID="edit-last-name"
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.optionsRow}>
        {GENDER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.optionButton, gender === option.value && styles.optionButtonSelected]}
            onPress={() => setGender(option.value)}
            disabled={isSubmitting}
            testID={`edit-gender-${option.value}`}
          >
            <Text style={[styles.optionText, gender === option.value && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Marital status</Text>
      <View style={styles.optionsRow}>
        {MARITAL_STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.optionButton, maritalStatus === option.value && styles.optionButtonSelected]}
            onPress={() => setMaritalStatus(option.value)}
            disabled={isSubmitting}
            testID={`edit-marital-status-${option.value}`}
          >
            <Text style={[styles.optionText, maritalStatus === option.value && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Birthdate</Text>
      <Pressable style={styles.input} onPress={handlePressBirthdate} disabled={isSubmitting} testID="edit-birthdate">
        <Text>{birthdate ? birthdate.toLocaleDateString() : "Select birthdate"}</Text>
      </Pressable>
      {Platform.OS === "ios" && showIosDatePicker ? (
        <DateTimePicker
          value={birthdate ?? new Date()}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowIosDatePicker(false);
            if (event.type === "set" && selectedDate) {
              setBirthdate(selectedDate);
            }
          }}
        />
      ) : null}

      <Text style={styles.label}>Groups</Text>
      {groups.length > 0 ? (
        <View style={styles.groupsList}>
          {groups.map((group) => (
            <View key={group.id} style={styles.groupRow} testID={`edit-group-${group.id}`}>
              <Text style={styles.groupName}>{group.name}</Text>
              {/* Not yet functional — no backend exists yet for a member to
                  remove themselves from a group (DELETE /api/assignments is
                  Admin-only). Rendered visually as a fast-follow marker;
                  deliberately no onPress rather than faking success or
                  silently no-op'ing on tap. */}
              <Text style={styles.groupRemoveIcon} testID={`edit-group-remove-${group.id}`}>
                ×
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.groupsEmpty}>No groups</Text>
      )}

      {error ? (
        <Text style={styles.error} testID="edit-profile-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="edit-profile-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
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
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  optionButtonSelected: {
    backgroundColor: "#2563eb",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  optionTextSelected: {
    color: "#fff",
  },
  groupsList: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  groupName: {
    fontSize: 15,
    color: "#333",
  },
  groupRemoveIcon: {
    fontSize: 18,
    color: "#999",
    paddingHorizontal: 4,
  },
  groupsEmpty: {
    fontSize: 14,
    color: "#555",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
    marginTop: 16,
  },
});
