import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { fetchMyProfile, updateMyProfile } from "@/src/features/members/services/myProfile.service";
import type { Gender, MaritalStatus, MemberGroup } from "@/src/features/members/types";
import { UnavailabilitySection } from "@/src/features/profile/components/UnavailabilitySection";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

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

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    center: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    inputText: { color: colors.text },
    optionButton: { backgroundColor: colors.backgroundSecondary },
    optionButtonSelected: { backgroundColor: colors.accent },
    optionText: { color: colors.text },
    groupsList: { borderColor: colors.border },
    groupRow: { borderBottomColor: colors.border },
    groupName: { color: colors.text },
    groupRemoveIcon: { color: colors.textMuted },
    groupsEmpty: { color: colors.textSecondary },
    button: { backgroundColor: colors.accent },
    error: { color: colors.danger },
  });
}

export default function EditProfileScreen() {
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
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
      <View style={[styles.center, themed.center]}>
        <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
          <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
        </Pressable>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.label, themed.label]}>First name</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={firstName}
        onChangeText={setFirstName}
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="edit-first-name"
      />

      <Text style={[styles.label, themed.label]}>Last name</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={lastName}
        onChangeText={setLastName}
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="edit-last-name"
      />

      <Text style={[styles.label, themed.label]}>Gender</Text>
      <View style={styles.optionsRow}>
        {GENDER_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.optionButton,
              themed.optionButton,
              gender === option.value && [styles.optionButtonSelected, themed.optionButtonSelected],
            ]}
            onPress={() => setGender(option.value)}
            disabled={isSubmitting}
            testID={`edit-gender-${option.value}`}
          >
            <Text style={[styles.optionText, themed.optionText, gender === option.value && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, themed.label]}>Marital status</Text>
      <View style={styles.optionsRow}>
        {MARITAL_STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            style={[
              styles.optionButton,
              themed.optionButton,
              maritalStatus === option.value && [styles.optionButtonSelected, themed.optionButtonSelected],
            ]}
            onPress={() => setMaritalStatus(option.value)}
            disabled={isSubmitting}
            testID={`edit-marital-status-${option.value}`}
          >
            <Text
              style={[styles.optionText, themed.optionText, maritalStatus === option.value && styles.optionTextSelected]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, themed.label]}>Birthdate</Text>
      <Pressable
        style={[styles.input, themed.input]}
        onPress={handlePressBirthdate}
        disabled={isSubmitting}
        testID="edit-birthdate"
      >
        <Text style={themed.inputText}>{birthdate ? birthdate.toLocaleDateString() : "Select birthdate"}</Text>
      </Pressable>
      {Platform.OS === "ios" && showIosDatePicker ? (
        <DateTimePicker
          value={birthdate ?? new Date()}
          mode="date"
          display="inline"
          themeVariant="light"
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowIosDatePicker(false);
            if (event.type === "set" && selectedDate) {
              setBirthdate(selectedDate);
            }
          }}
        />
      ) : null}

      <Text style={[styles.label, themed.label]}>Groups</Text>
      {groups.length > 0 ? (
        <View style={[styles.groupsList, themed.groupsList]}>
          {groups.map((group) => (
            <View key={group.id} style={[styles.groupRow, themed.groupRow]} testID={`edit-group-${group.id}`}>
              <Text style={[styles.groupName, themed.groupName]}>{group.name}</Text>
              {/* Not yet functional — no backend exists yet for a member to
                  remove themselves from a group (DELETE /api/assignments is
                  Admin-only). Rendered visually as a fast-follow marker;
                  deliberately no onPress rather than faking success or
                  silently no-op'ing on tap. */}
              <Text style={[styles.groupRemoveIcon, themed.groupRemoveIcon]} testID={`edit-group-remove-${group.id}`}>
                ×
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.groupsEmpty, themed.groupsEmpty]}>No groups</Text>
      )}

      {error ? (
        <Text style={[styles.error, themed.error]} testID="edit-profile-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.button, themed.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="edit-profile-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save</Text>}
      </Pressable>

      {/* DIP-FP-190-mobile: add/delete are independent immediate API calls,
          not batched with the Save button above — this section owns its
          own load/error state entirely. */}
      <UnavailabilitySection />

      {/* DIP-FP-186-mobile: change-password is a new sibling screen, not a
          field folded into this form — mirrors how preferences.tsx is
          already its own separate screen off the profile menu. */}
      <Pressable
        style={styles.changePasswordLink}
        onPress={() => router.push("/(app)/profile/change-password")}
        testID="edit-profile-change-password-link"
      >
        <Text style={[styles.changePasswordLinkText, themed.backLinkText]}>Change Password</Text>
      </Pressable>

      {/* DIP-FP-187-mobile: same sibling-screen pattern as Change Password
          above, but destructive-styled (colors.danger, same precedent as
          Avatar.tsx's own Sign Out link) given its irreversibility. */}
      <Pressable
        style={styles.deleteAccountLink}
        onPress={() => router.push("/(app)/profile/delete-account")}
        testID="edit-profile-delete-account-link"
      >
        <Text style={[styles.deleteAccountLinkText, themed.error]}>Delete My Account</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backLinkText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
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
  changePasswordLink: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  changePasswordLinkText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteAccountLink: {
    alignItems: "center",
    marginBottom: 24,
  },
  deleteAccountLinkText: {
    color: "#c0392b",
    fontSize: 15,
    fontWeight: "600",
  },
});
