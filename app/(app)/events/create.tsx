import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { createEvent, listMyEvents, publishEvent } from "@/src/features/events/services/events.service";
import { listEventTypes } from "@/src/features/event-types/services/eventTypes.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import {
  formationDisplayName,
  listCourses,
  listModules,
  listTalks,
} from "@/src/features/formation/services/formation.service";
import { MemberGroupPicker } from "@/src/features/shared/components/MemberGroupPicker";
import type { TargetSelection } from "@/src/features/shared/components/MemberGroupPicker";
import type { EventType } from "@/src/features/event-types/types";
import type { Course, FormationModule, Talk } from "@/src/features/formation/types";
import type { CreatedEvent } from "@/src/features/events/types";

const EMPTY_SELECTION: TargetSelection = { group_ids: [], member_ids: [] };

function formatDateTime(date: Date | null): string {
  if (!date) return "Select date & time";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function FormationTalkPicker({
  talkLabel,
  onChange,
}: {
  talkLabel: string | undefined;
  onChange: (talkId: string | undefined, label: string | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"course" | "module" | "talk">("course");
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<FormationModule[]>([]);
  const [talks, setTalks] = useState<Talk[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedModule, setSelectedModule] = useState<FormationModule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => {
    setIsOpen(true);
    setStep("course");
    setIsLoading(true);
    setError(null);
    listCourses()
      .then(setCourses)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load courses."))
      .finally(() => setIsLoading(false));
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    setStep("module");
    setIsLoading(true);
    setError(null);
    listModules(course.id)
      .then(setModules)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load modules."))
      .finally(() => setIsLoading(false));
  };

  const handleSelectModule = (courseModule: FormationModule) => {
    setSelectedModule(courseModule);
    setStep("talk");
    setIsLoading(true);
    setError(null);
    listTalks(courseModule.id)
      .then(setTalks)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load talks."))
      .finally(() => setIsLoading(false));
  };

  const handleSelectTalk = (talk: Talk) => {
    const label = `${formationDisplayName(selectedCourse!)} › ${formationDisplayName(selectedModule!)} › ${formationDisplayName(talk)}`;
    onChange(talk.id, label);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>Formation Talk (optional)</Text>
      <Pressable style={styles.input} onPress={openPicker} testID="formation-talk-open">
        <Text>{talkLabel ?? "None"}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {step === "course" ? "Select Course" : step === "module" ? "Select Module" : "Select Talk"}
            </Text>
            <Pressable onPress={() => setIsOpen(false)} testID="formation-talk-close">
              <Text style={styles.doneText}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.modalActionsRow}>
            {step !== "course" ? (
              <Pressable
                onPress={() => setStep(step === "talk" ? "module" : "course")}
                testID="formation-talk-back"
              >
                <Text style={styles.linkText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable onPress={handleClear} testID="formation-talk-clear">
              <Text style={styles.linkText}>Clear selection</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : step === "course" ? (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleSelectCourse(item)}
                  testID={`formation-course-${item.id}`}
                >
                  <Text style={styles.optionLabel}>{formationDisplayName(item)}</Text>
                </Pressable>
              )}
            />
          ) : step === "module" ? (
            <FlatList
              data={modules}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleSelectModule(item)}
                  testID={`formation-module-${item.id}`}
                >
                  <Text style={styles.optionLabel}>{formationDisplayName(item)}</Text>
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={talks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleSelectTalk(item)}
                  testID={`formation-talk-${item.id}`}
                >
                  <Text style={styles.optionLabel}>{formationDisplayName(item)}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function CreateEventScreen() {
  const [name, setName] = useState("");
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [eventTypeId, setEventTypeId] = useState<string | null>(null);
  const [startDatetime, setStartDatetime] = useState<Date | null>(null);
  const [endDatetime, setEndDatetime] = useState<Date | null>(null);
  const [showIosPicker, setShowIosPicker] = useState<"start" | "end" | null>(null);
  const [iosDraftDate, setIosDraftDate] = useState<Date>(new Date());
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [target, setTarget] = useState<TargetSelection>(EMPTY_SELECTION);
  const [talkId, setTalkId] = useState<string | undefined>(undefined);
  const [talkLabel, setTalkLabel] = useState<string | undefined>(undefined);
  const [prayerLeader, setPrayerLeader] = useState<TargetSelection>(EMPTY_SELECTION);
  const [foodAssignment, setFoodAssignment] = useState<TargetSelection>(EMPTY_SELECTION);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listEventTypes()
      .then(setEventTypes)
      .catch(() => {
        // Left as an empty list rather than blocking the form — the
        // required-field validation below will catch an unselected
        // eventTypeId at submit time either way.
      });
  }, []);

  const openDateTimePicker = (which: "start" | "end") => {
    const current = (which === "start" ? startDatetime : endDatetime) ?? new Date();
    if (Platform.OS === "android") {
      // AndroidMode only supports 'date' | 'time' (no combined 'datetime'
      // mode) — pick date first, then time, then combine.
      DateTimePickerAndroid.open({
        value: current,
        mode: "date",
        onChange: (dateEvent, selectedDate) => {
          if (dateEvent.type !== "set" || !selectedDate) return;
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: "time",
            onChange: (timeEvent, selectedTime) => {
              if (timeEvent.type !== "set" || !selectedTime) return;
              const combined = new Date(selectedDate);
              combined.setHours(selectedTime.getHours(), selectedTime.getMinutes());
              (which === "start" ? setStartDatetime : setEndDatetime)(combined);
            },
          });
        },
      });
    } else {
      setIosDraftDate(current);
      setShowIosPicker(which);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (
      !name.trim() ||
      !eventTypeId ||
      !startDatetime ||
      !endDatetime ||
      !locationName.trim() ||
      !locationAddress.trim()
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (target.group_ids.length === 0 && target.member_ids.length === 0) {
      setError("Please select at least one target group or member.");
      return;
    }

    setIsSubmitting(true);

    let created: CreatedEvent;
    try {
      created = await createEvent({
        eventTypeId,
        name: name.trim(),
        startDatetime: startDatetime.toISOString(),
        endDatetime: endDatetime.toISOString(),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        ...(locationUrl.trim() ? { locationUrl: locationUrl.trim() } : {}),
        target,
        ...(talkId ? { talkId } : {}),
        ...(prayerLeader.member_ids[0] ? { prayerLeaderMemberId: prayerLeader.member_ids[0] } : {}),
        ...(foodAssignment.group_ids.length || foodAssignment.member_ids.length ? { foodAssignment } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Create-and-publish as one user action — a mobile, on-the-go
      // creation flow, not a separate draft-review step. Flagged as a UX
      // default in the DIP, not a spec requirement.
      await publishEvent(created.id);

      // FP-96-FP-97-adj-1: My Events' own mount effect (where reconciliation
      // normally runs) deliberately doesn't refetch on focus, so without
      // this, a newly created event's self-report/event reminders would
      // never get scheduled until the next cold app relaunch or manual
      // pull-to-refresh. Passing the full fetched list (not just `created`)
      // matters — both reconcile functions cancel any already-scheduled
      // reminder whose identifier isn't in the list they're given, so a
      // single-event array would wrongly cancel every other event's
      // reminders.
      const freshEvents = await listMyEvents();
      reconcileEventReminders(freshEvents).catch((err) => console.warn("Failed to reconcile event reminders:", err));
      reconcileSelfReportReminders(freshEvents).catch((err) =>
        console.warn("Failed to reconcile self-report reminders:", err)
      );
      reconcileConfirmationReminders().catch((err) =>
        console.warn("Failed to reconcile confirmation reminders:", err)
      );
      router.back();
    } catch (err) {
      // The event was created (exists in DRAFT) even though publishing
      // failed — e.g. a Leader-tier caller, since /publish is
      // requireRole('ADMIN')-gated server-side today (DIP Grounding Check
      // gap — see PR description). Distinct message so the user doesn't
      // think nothing happened and re-submit a duplicate event.
      setError(
        `Event created but could not be published${err instanceof Error ? `: ${err.message}` : "."} An admin may need to publish it.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={styles.backLinkText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        editable={!isSubmitting}
        testID="create-event-name"
      />

      <Text style={styles.label}>Event Type</Text>
      <View style={styles.optionsRow}>
        {eventTypes.map((type) => (
          <Pressable
            key={type.id}
            style={[styles.optionButton, eventTypeId === type.id && styles.optionButtonSelected]}
            onPress={() => setEventTypeId(type.id)}
            disabled={isSubmitting}
            testID={`create-event-type-${type.id}`}
          >
            <Text style={[styles.optionText, eventTypeId === type.id && styles.optionTextSelected]}>
              {type.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Start</Text>
      <Pressable
        style={styles.input}
        onPress={() => openDateTimePicker("start")}
        disabled={isSubmitting}
        testID="create-event-start"
      >
        <Text>{formatDateTime(startDatetime)}</Text>
      </Pressable>

      <Text style={styles.label}>End</Text>
      <Pressable
        style={styles.input}
        onPress={() => openDateTimePicker("end")}
        disabled={isSubmitting}
        testID="create-event-end"
      >
        <Text>{formatDateTime(endDatetime)}</Text>
      </Pressable>

      {/* DIP Grounding Check: display="spinner" fires onChange on every
          wheel tick, not just on a final confirm — committing and closing
          on the very first tick (the old inline behavior) cut the user off
          after adjusting just one wheel (e.g. the hour) before they could
          touch the date or minutes. This tracks the in-progress value in
          iosDraftDate and only commits it to start/endDatetime when Done is
          tapped; Cancel/backdrop discards the draft instead. */}
      <Modal
        visible={Platform.OS === "ios" && showIosPicker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIosPicker(null)}
      >
        <Pressable
          style={styles.iosPickerBackdrop}
          onPress={() => setShowIosPicker(null)}
          testID="ios-picker-backdrop"
        />
        <View style={styles.iosPickerCard}>
          <View style={styles.iosPickerHeader}>
            <Pressable onPress={() => setShowIosPicker(null)} testID="ios-picker-cancel">
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const which = showIosPicker;
                setShowIosPicker(null);
                if (which) {
                  (which === "start" ? setStartDatetime : setEndDatetime)(iosDraftDate);
                }
              }}
              testID="ios-picker-done"
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={iosDraftDate}
            mode="datetime"
            display="spinner"
            onChange={(_event, selectedDate) => {
              if (selectedDate) setIosDraftDate(selectedDate);
            }}
          />
        </View>
      </Modal>

      <Text style={styles.label}>Location Name</Text>
      <TextInput
        style={styles.input}
        value={locationName}
        onChangeText={setLocationName}
        editable={!isSubmitting}
        testID="create-event-location-name"
      />

      <Text style={styles.label}>Location Address</Text>
      <TextInput
        style={styles.input}
        value={locationAddress}
        onChangeText={setLocationAddress}
        editable={!isSubmitting}
        testID="create-event-location-address"
      />

      <Text style={styles.label}>Location URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={locationUrl}
        onChangeText={setLocationUrl}
        editable={!isSubmitting}
        autoCapitalize="none"
        testID="create-event-location-url"
      />

      <MemberGroupPicker label="Target Audience" value={target} onChange={setTarget} />

      <FormationTalkPicker
        talkLabel={talkLabel}
        onChange={(id, label) => {
          setTalkId(id);
          setTalkLabel(label);
        }}
      />

      <MemberGroupPicker
        label="Prayer Leader (optional)"
        value={prayerLeader}
        onChange={setPrayerLeader}
        allowGroups={false}
        singleMember
      />

      <MemberGroupPicker label="Food Assignment (optional)" value={foodAssignment} onChange={setFoodAssignment} />

      {error ? (
        <Text style={styles.error} testID="create-event-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="create-event-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Event</Text>}
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
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 32,
    marginBottom: 48,
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
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  linkText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },
  center: {
    marginTop: 24,
  },
  iosPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  iosPickerCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  optionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  optionLabel: {
    fontSize: 15,
    color: "#333",
  },
});
