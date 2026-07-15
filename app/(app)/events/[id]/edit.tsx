import { useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { ApiError } from "@/src/lib/api";
import { listMeetingResources, listMyEvents, updateEvent } from "@/src/features/events/services/events.service";
import {
  formationDisplayName,
  listCourses,
  listModules,
  listTalks,
} from "@/src/features/formation/services/formation.service";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import { MemberGroupPicker } from "@/src/features/shared/components/MemberGroupPicker";
import type { TargetSelection } from "@/src/features/shared/components/MemberGroupPicker";
import type { Course, FormationModule, Talk } from "@/src/features/formation/types";
import type { EventDetail, MeetingResource } from "@/src/features/events/types";

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

function targetToSelection(target: { group_ids?: string[]; member_ids?: string[] } | null | undefined): TargetSelection {
  return { group_ids: target?.group_ids ?? [], member_ids: target?.member_ids ?? [] };
}

// Duplicated from create.tsx rather than extracted to a shared component —
// the DIP's file list only names MemberGroupPicker as shared, and this is
// still only used from these two screens. Flagged as a candidate for
// extraction if a third consumer shows up.
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

// Mirrors FormationTalkPicker's modal-list convention (open button + slide-up
// Modal + FlatList), single-level rather than a course/module/talk
// drill-down since meeting resources have no such hierarchy. Duplicated from
// create.tsx for the same reason FormationTalkPicker is duplicated above —
// only these two screens consume it.
function MeetingResourcePicker({
  resourceLabel,
  onChange,
}: {
  resourceLabel: string | undefined;
  onChange: (resourceId: string | undefined, label: string | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [resources, setResources] = useState<MeetingResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => {
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    listMeetingResources()
      .then(setResources)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Zoom accounts."))
      .finally(() => setIsLoading(false));
  };

  const handleSelect = (resource: MeetingResource) => {
    onChange(resource.id, resource.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(undefined, undefined);
    setIsOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>Zoom Account</Text>
      <Pressable style={styles.input} onPress={openPicker} testID="meeting-resource-open">
        <Text>{resourceLabel ?? "None"}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Zoom Account</Text>
            <Pressable onPress={() => setIsOpen(false)} testID="meeting-resource-close">
              <Text style={styles.doneText}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.modalActionsRow}>
            <View />
            <Pressable onPress={handleClear} testID="meeting-resource-clear">
              <Text style={styles.linkText}>Clear selection</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <FlatList
              data={resources}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.optionRow}
                  onPress={() => handleSelect(item)}
                  testID={`meeting-resource-${item.id}`}
                >
                  <Text style={styles.optionLabel}>{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function EditEventScreen() {
  const params = useLocalSearchParams<{ id: string; event?: string }>();

  // Pre-filled directly from the event object passed via route params (the
  // same JSON-over-params pattern used throughout this app) rather than
  // re-fetching — the detail screen that navigated here already holds a
  // freshly-fetched EventDetail. No parse-error UI: getting here at all
  // requires having successfully rendered the detail screen's Edit button
  // first, which only exists once that screen already has a valid event.
  const initialEvent = JSON.parse(params.event ?? "{}") as EventDetail;

  const [name, setName] = useState(initialEvent.name ?? "");
  const [startDatetime, setStartDatetime] = useState<Date | null>(
    initialEvent.start_datetime ? new Date(initialEvent.start_datetime) : null
  );
  const [endDatetime, setEndDatetime] = useState<Date | null>(
    initialEvent.end_datetime ? new Date(initialEvent.end_datetime) : null
  );
  const [showIosPicker, setShowIosPicker] = useState<"start" | "end" | null>(null);
  const [iosDraftDate, setIosDraftDate] = useState<Date>(new Date());
  const [locationName, setLocationName] = useState(initialEvent.location_name ?? "");
  const [locationAddress, setLocationAddress] = useState(initialEvent.location_address ?? "");
  const [locationUrl, setLocationUrl] = useState(initialEvent.location_url ?? "");
  const [meetingMode, setMeetingMode] = useState<"none" | "zoom" | "other">(
    initialEvent.online_meeting_resource_id ? "zoom" : initialEvent.online_meeting_url ? "other" : "none"
  );
  const [onlineMeetingResourceId, setOnlineMeetingResourceId] = useState<string | undefined>(
    initialEvent.online_meeting_resource_id ?? undefined
  );
  // Same placeholder-label convention as talkLabel below: the event only
  // carries the resource id, not its display name — resolving that would
  // mean fetching the full meeting-resource list just to find a match.
  // Opening the picker to actually change it always produces an accurate
  // label.
  const [onlineMeetingResourceLabel, setOnlineMeetingResourceLabel] = useState<string | undefined>(
    initialEvent.online_meeting_resource_id ? "Zoom account selected (tap to change)" : undefined
  );
  const [onlineMeetingPlatformLabel, setOnlineMeetingPlatformLabel] = useState(
    initialEvent.online_meeting_platform_label ?? ""
  );
  const [onlineMeetingUrl, setOnlineMeetingUrl] = useState(initialEvent.online_meeting_url ?? "");
  const [target, setTarget] = useState<TargetSelection>(targetToSelection(initialEvent.target));
  const [talkId, setTalkId] = useState<string | undefined>(initialEvent.talk_id ?? undefined);
  // The event only carries talk_id, not the Course › Module › Talk display
  // label — resolving that would mean walking every course/module to find a
  // match. Rather than fake a label, show a plain placeholder that's honest
  // about what's known; opening the picker to actually change it always
  // produces an accurate label, same as create.tsx.
  const [talkLabel, setTalkLabel] = useState<string | undefined>(
    initialEvent.talk_id ? "Talk selected (tap to change)" : undefined
  );
  const [prayerLeader, setPrayerLeader] = useState<TargetSelection>({
    group_ids: [],
    member_ids: initialEvent.prayer_leader_member_id ? [initialEvent.prayer_leader_member_id] : [],
  });
  const [foodAssignment, setFoodAssignment] = useState<TargetSelection>(
    targetToSelection(initialEvent.food_assignment)
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    if (!name.trim() || !startDatetime || !endDatetime || !locationName.trim() || !locationAddress.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (target.group_ids.length === 0 && target.member_ids.length === 0) {
      setError("Please select at least one target group or member.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Every field is sent explicitly (null for "cleared"), never omitted —
      // the PATCH route treats an omitted key as "no change" via a JSONB
      // key-presence check, not a truthiness check, so this is a full-form
      // submission, not a sparse diff. See UpdateEventInput's doc comment.
      await updateEvent(params.id, {
        name: name.trim(),
        startDatetime: startDatetime.toISOString(),
        endDatetime: endDatetime.toISOString(),
        locationName: locationName.trim(),
        locationAddress: locationAddress.trim(),
        locationUrl: locationUrl.trim() ? locationUrl.trim() : null,
        onlineMeetingResourceId: meetingMode === "zoom" ? (onlineMeetingResourceId ?? null) : null,
        onlineMeetingUrl: meetingMode === "other" && onlineMeetingUrl.trim() ? onlineMeetingUrl.trim() : null,
        onlineMeetingPlatformLabel:
          meetingMode === "other" && onlineMeetingPlatformLabel.trim() ? onlineMeetingPlatformLabel.trim() : null,
        target,
        talkId: talkId ?? null,
        prayerLeaderMemberId: prayerLeader.member_ids[0] ?? null,
        foodAssignment:
          foodAssignment.group_ids.length || foodAssignment.member_ids.length ? foodAssignment : null,
      });

      // FP-96-FP-97-adj-1: My Events' own mount effect (where reconciliation
      // normally runs) deliberately doesn't refetch on focus, so without
      // this, an edited event's self-report/event reminders would never get
      // rescheduled until the next cold app relaunch or manual pull-to-
      // refresh. Passing the full fetched list (not just this one event)
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
      if (err instanceof ApiError && err.code === "MEETING_RESOURCE_CONFLICT" && err.conflict) {
        const c = err.conflict;
        setError(
          `Zoom account selected is already booked for "${c.eventName}" on ` +
            `${new Date(c.startDatetime).toLocaleString()} by ${c.bookedByName}.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to update event.");
      }
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
        testID="edit-event-name"
      />

      {/* No Event Type field: confirmed against the PATCH route handler
          that eventTypeId is never destructured from the request body — it
          is immutable once the event is created. */}

      <Text style={styles.label}>Start</Text>
      <Pressable
        style={styles.input}
        onPress={() => openDateTimePicker("start")}
        disabled={isSubmitting}
        testID="edit-event-start"
      >
        <Text>{formatDateTime(startDatetime)}</Text>
      </Pressable>

      <Text style={styles.label}>End</Text>
      <Pressable
        style={styles.input}
        onPress={() => openDateTimePicker("end")}
        disabled={isSubmitting}
        testID="edit-event-end"
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
            themeVariant="light"
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
        testID="edit-event-location-name"
      />

      <Text style={styles.label}>Location Address</Text>
      <TextInput
        style={styles.input}
        value={locationAddress}
        onChangeText={setLocationAddress}
        editable={!isSubmitting}
        testID="edit-event-location-address"
      />

      <Text style={styles.label}>Location URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={locationUrl}
        onChangeText={setLocationUrl}
        editable={!isSubmitting}
        autoCapitalize="none"
        testID="edit-event-location-url"
      />

      <Text style={styles.label}>Online Meeting (optional)</Text>
      <View style={styles.optionsRow}>
        {(["none", "zoom", "other"] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.optionButton, meetingMode === mode && styles.optionButtonSelected]}
            onPress={() => setMeetingMode(mode)}
            disabled={isSubmitting}
            testID={`edit-event-meeting-mode-${mode}`}
          >
            <Text style={[styles.optionText, meetingMode === mode && styles.optionTextSelected]}>
              {mode === "none" ? "None" : mode === "zoom" ? "Zoom Account" : "Other Platform"}
            </Text>
          </Pressable>
        ))}
      </View>

      {meetingMode === "zoom" ? (
        <MeetingResourcePicker
          resourceLabel={onlineMeetingResourceLabel}
          onChange={(id, label) => {
            setOnlineMeetingResourceId(id);
            setOnlineMeetingResourceLabel(label);
          }}
        />
      ) : null}

      {meetingMode === "other" ? (
        <>
          <Text style={styles.label}>Platform Name</Text>
          <TextInput
            style={styles.input}
            value={onlineMeetingPlatformLabel}
            onChangeText={setOnlineMeetingPlatformLabel}
            editable={!isSubmitting}
            placeholder="e.g. Google Meet"
            testID="edit-event-meeting-platform-label"
          />

          <Text style={styles.label}>Meeting Link</Text>
          <TextInput
            style={styles.input}
            value={onlineMeetingUrl}
            onChangeText={setOnlineMeetingUrl}
            editable={!isSubmitting}
            autoCapitalize="none"
            testID="edit-event-meeting-url"
          />
        </>
      ) : null}

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
        <Text style={styles.error} testID="edit-event-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        testID="edit-event-submit"
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
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
