import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { ApiError } from "@/src/lib/api";
import {
  createEvent,
  listMeetingResources,
  listMyEvents,
  publishEvent,
} from "@/src/features/events/services/events.service";
import { listEventTypes } from "@/src/features/event-types/services/eventTypes.service";
import { createEventTaskAssignment, listTasks } from "@/src/features/tasks/services/tasks.service";
import { CORE_TASK_NAMES } from "@/src/features/tasks/types";
import type { Task } from "@/src/features/tasks/types";
import { reconcileEventReminders } from "@/src/features/notifications/services/reminders.service";
import { reconcileSelfReportReminders } from "@/src/features/notifications/services/selfReportReminders.service";
import { reconcileConfirmationReminders } from "@/src/features/notifications/services/confirmationReminders.service";
import { reconcileRsvpNudges } from "@/src/features/notifications/services/rsvpNudgeReminders.service";
import {
  formationDisplayName,
  listCourses,
  listModules,
  listTalks,
} from "@/src/features/formation/services/formation.service";
import { GroupMemberChipPicker } from "@/src/features/shared/components/GroupMemberChipPicker";
import type { TargetSelection } from "@/src/features/shared/components/MemberGroupPicker";
import type { EventType } from "@/src/features/event-types/types";
import type { Course, FormationModule, Talk } from "@/src/features/formation/types";
import type { CreatedEvent, MeetingResource } from "@/src/features/events/types";
import { useThemeColors } from "@/src/theme/useThemeColors";
import type { ThemeColors } from "@/src/theme/colors";

const EMPTY_SELECTION: TargetSelection = { group_ids: [], member_ids: [] };

// Only the color-bearing keys from `styles` below, recomputed from the
// current theme at render time — everything structural stays in the static
// StyleSheet.create() untouched. Merged on top via style arrays. Shared by
// all three components in this file (CreateEventScreen, FormationTalkPicker,
// MeetingResourcePicker), computed once in CreateEventScreen and passed down
// as a prop — same convention as confirmations/index.tsx's ConfirmationItem.
function getThemedStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { backgroundColor: colors.background },
    backLinkText: { color: colors.accent },
    label: { color: colors.text },
    input: { borderColor: colors.border, color: colors.text },
    inputText: { color: colors.text },
    optionButton: { backgroundColor: colors.backgroundSecondary },
    optionButtonSelected: { backgroundColor: colors.accent },
    optionText: { color: colors.text },
    submitButton: { backgroundColor: colors.accent },
    error: { color: colors.danger },
    modalContainer: { backgroundColor: colors.background },
    modalTitle: { color: colors.text },
    doneText: { color: colors.accent },
    linkText: { color: colors.accent },
    iosPickerCard: { backgroundColor: colors.cardBackground },
    iosPickerHeader: { borderBottomColor: colors.border },
    optionRow: { borderBottomColor: colors.border },
    optionRowSelected: { backgroundColor: colors.backgroundSecondary },
    optionLabel: { color: colors.text },
    optionLabelSelected: { color: colors.accent },
    switchCaption: { color: colors.textSecondary },
  });
}

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
  themed,
}: {
  talkLabel: string | undefined;
  onChange: (talkId: string | undefined, label: string | undefined) => void;
  themed: ReturnType<typeof getThemedStyles>;
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
      <Text style={[styles.label, themed.label]}>Formation Talk (optional)</Text>
      <Pressable style={[styles.input, themed.input]} onPress={openPicker} testID="formation-talk-open">
        <Text style={themed.inputText}>{talkLabel ?? "None"}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.modalContainer, themed.modalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, themed.modalTitle]}>
              {step === "course" ? "Select Course" : step === "module" ? "Select Module" : "Select Talk"}
            </Text>
            <Pressable onPress={() => setIsOpen(false)} testID="formation-talk-close">
              <Text style={[styles.doneText, themed.doneText]}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.modalActionsRow}>
            {step !== "course" ? (
              <Pressable
                onPress={() => setStep(step === "talk" ? "module" : "course")}
                testID="formation-talk-back"
              >
                <Text style={[styles.linkText, themed.linkText]}>‹ Back</Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable onPress={handleClear} testID="formation-talk-clear">
              <Text style={[styles.linkText, themed.linkText]}>Clear selection</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={[styles.error, themed.error]}>{error}</Text>
          ) : step === "course" ? (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, themed.optionRow]}
                  onPress={() => handleSelectCourse(item)}
                  testID={`formation-course-${item.id}`}
                >
                  <Text style={[styles.optionLabel, themed.optionLabel]}>{formationDisplayName(item)}</Text>
                </Pressable>
              )}
            />
          ) : step === "module" ? (
            <FlatList
              data={modules}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, themed.optionRow]}
                  onPress={() => handleSelectModule(item)}
                  testID={`formation-module-${item.id}`}
                >
                  <Text style={[styles.optionLabel, themed.optionLabel]}>{formationDisplayName(item)}</Text>
                </Pressable>
              )}
            />
          ) : (
            <FlatList
              data={talks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, themed.optionRow]}
                  onPress={() => handleSelectTalk(item)}
                  testID={`formation-talk-${item.id}`}
                >
                  <Text style={[styles.optionLabel, themed.optionLabel]}>{formationDisplayName(item)}</Text>
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
// drill-down since meeting resources have no such hierarchy.
function MeetingResourcePicker({
  resourceLabel,
  selectedResourceId,
  onChange,
  themed,
}: {
  resourceLabel: string | undefined;
  selectedResourceId: string | undefined;
  onChange: (resourceId: string | undefined, label: string | undefined) => void;
  themed: ReturnType<typeof getThemedStyles>;
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
      <Text style={[styles.label, themed.label]}>Zoom Account</Text>
      <Pressable style={[styles.input, themed.input]} onPress={openPicker} testID="meeting-resource-open">
        <Text style={themed.inputText}>{resourceLabel ?? "None"}</Text>
      </Pressable>

      <Modal visible={isOpen} animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <View style={[styles.modalContainer, themed.modalContainer]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, themed.modalTitle]}>Select Zoom Account</Text>
            <Pressable onPress={() => setIsOpen(false)} testID="meeting-resource-close">
              <Text style={[styles.doneText, themed.doneText]}>Cancel</Text>
            </Pressable>
          </View>

          <View style={styles.modalActionsRow}>
            <View />
            <Pressable onPress={handleClear} testID="meeting-resource-clear">
              <Text style={[styles.linkText, themed.linkText]}>Clear selection</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator style={styles.center} />
          ) : error ? (
            <Text style={[styles.error, themed.error]}>{error}</Text>
          ) : (
            <FlatList
              data={resources}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.optionRow,
                    themed.optionRow,
                    item.id === selectedResourceId && [styles.optionRowSelected, themed.optionRowSelected],
                  ]}
                  onPress={() => handleSelect(item)}
                  testID={`meeting-resource-${item.id}`}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      themed.optionLabel,
                      item.id === selectedResourceId && [styles.optionLabelSelected, themed.optionLabelSelected],
                    ]}
                  >
                    {item.name}
                  </Text>
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
  const colors = useThemeColors();
  const themed = useMemo(() => getThemedStyles(colors), [colors]);
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
  // DIP-FP-132-FP-133-FP-134: blank = tenant default (omitted on submit),
  // string state so the numeric TextInput can hold an in-progress/invalid
  // value without fighting controlled-input semantics, same as `code` in
  // MfaVerifyForm.
  const [rsvpClosureDays, setRsvpClosureDays] = useState("");
  // DIP-FP-189-adj-1: mirrors web's EventForm.tsx "Guests Allowed" checkbox.
  const [guestsAllowed, setGuestsAllowed] = useState(false);
  const [meetingMode, setMeetingMode] = useState<"none" | "zoom" | "other">("none");
  const [onlineMeetingResourceId, setOnlineMeetingResourceId] = useState<string | undefined>(undefined);
  const [onlineMeetingResourceLabel, setOnlineMeetingResourceLabel] = useState<string | undefined>(undefined);
  const [onlineMeetingPlatformLabel, setOnlineMeetingPlatformLabel] = useState("");
  const [onlineMeetingUrl, setOnlineMeetingUrl] = useState("");
  const [target, setTarget] = useState<TargetSelection>(EMPTY_SELECTION);
  // DIP-FP-191-mobile-adj-3: only meaningful when isAnnouncement below.
  const [announcementBody, setAnnouncementBody] = useState("");
  const [talkId, setTalkId] = useState<string | undefined>(undefined);
  const [talkLabel, setTalkLabel] = useState<string | undefined>(undefined);
  // DIP-FP-161-3-task-wiring: replaces the old dedicated prayerLeader/
  // foodAssignment state — tasks is the fetched catalog, taskAssignments
  // holds each displayed task's current picker selection keyed by task id,
  // addedTaskIds tracks which non-core catalog tasks the user has
  // explicitly added via the "Add Task" control below (the three core
  // tasks are always displayed and never need adding).
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<Record<string, TargetSelection>>({});
  const [addedTaskIds, setAddedTaskIds] = useState<string[]>([]);

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

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch(() => {
        // Left as an empty list rather than blocking the form, same
        // non-fatal handling as listEventTypes above — the three core
        // tasks simply won't render pickers until the catalog loads.
      });
  }, []);

  const coreTasks = useMemo(() => tasks.filter((t) => CORE_TASK_NAMES.includes(t.name)), [tasks]);
  const addedTasks = useMemo(() => tasks.filter((t) => addedTaskIds.includes(t.id)), [tasks, addedTaskIds]);
  const availableToAddTasks = useMemo(
    () => tasks.filter((t) => !CORE_TASK_NAMES.includes(t.name) && !addedTaskIds.includes(t.id)),
    [tasks, addedTaskIds]
  );
  const displayedTasks = useMemo(() => [...coreTasks, ...addedTasks], [coreTasks, addedTasks]);

  const setTaskAssignment = (taskId: string, selection: TargetSelection) => {
    setTaskAssignments((prev) => ({ ...prev, [taskId]: selection }));
  };

  // DIP-FP-191-mobile-adj-3: system_key === 'ANNOUNCEMENT' confirmed live
  // against web's event-types repository — same signal EventListItem.tsx/
  // AnnouncementSection already use elsewhere in this app (see EventType's
  // doc comment for the note on web's own admin form using `code` for this
  // same check instead).
  const isAnnouncement = eventTypes.find((t) => t.id === eventTypeId)?.system_key === "ANNOUNCEMENT";

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

    // DIP-FP-191-mobile-adj-3: Announcement submissions skip the location/
    // target requiredness checks entirely — only name/startDatetime (plus
    // the Announcement Body field, which the DIP's own "Show" bullet labels
    // required even though its validation bullet didn't explicitly list it)
    // are meaningful for this type.
    if (isAnnouncement) {
      if (!name.trim() || !eventTypeId || !startDatetime || !announcementBody.trim()) {
        setError("Please fill in all required fields.");
        return;
      }
    } else {
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
    }

    setIsSubmitting(true);

    let created: CreatedEvent;
    try {
      created = isAnnouncement
        ? await createEvent({
            eventTypeId,
            name: name.trim(),
            startDatetime: startDatetime!.toISOString(),
            // DIP Grounding Check: web's POST /api/events still requires
            // endDatetime/locationName/locationAddress/target truthy in the
            // request body (a pre-RPC MISSING_FIELD check) even though
            // insert_event_with_audit force-overrides all of them for
            // Announcement-type events server-side — these placeholder
            // values exist purely to satisfy that check, mirroring web's
            // own EventForm.tsx convention.
            endDatetime: new Date(startDatetime!.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            locationName: "Announcement",
            locationAddress: "N/A",
            target: EMPTY_SELECTION,
            announcementBody: announcementBody.trim(),
          })
        : await createEvent({
            eventTypeId,
            name: name.trim(),
            startDatetime: startDatetime!.toISOString(),
            endDatetime: endDatetime!.toISOString(),
            locationName: locationName.trim(),
            locationAddress: locationAddress.trim(),
            ...(locationUrl.trim() ? { locationUrl: locationUrl.trim() } : {}),
            ...(meetingMode === "zoom" && onlineMeetingResourceId ? { onlineMeetingResourceId } : {}),
            ...(meetingMode === "other" && onlineMeetingUrl.trim()
              ? {
                  onlineMeetingUrl: onlineMeetingUrl.trim(),
                  ...(onlineMeetingPlatformLabel.trim()
                    ? { onlineMeetingPlatformLabel: onlineMeetingPlatformLabel.trim() }
                    : {}),
                }
              : {}),
            target,
            ...(talkId ? { talkId } : {}),
            ...(rsvpClosureDays.trim() ? { rsvpClosureDays: Number(rsvpClosureDays.trim()) } : {}),
            guestsAllowed,
          });
    } catch (err) {
      if (err instanceof ApiError && err.code === "MEETING_RESOURCE_CONFLICT" && err.conflict) {
        const c = err.conflict;
        setError(
          `Zoom account selected is already booked for "${c.eventName}" on ` +
            `${new Date(c.startDatetime).toLocaleString()} by ${c.bookedByName}.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to create event.");
      }
      setIsSubmitting(false);
      return;
    }

    // DIP-FP-161-3-task-wiring: task assignments are a separate resource
    // from the event itself now (event-tasks-assignments), created here as
    // a follow-up step — omitted entirely for any displayed task left with
    // an empty selection, same "optional, no row if blank" behavior the old
    // prayerLeaderMemberId/foodAssignment fields had.
    try {
      await Promise.all(
        displayedTasks
          .filter((task) => {
            const selection = taskAssignments[task.id];
            return selection && (selection.group_ids.length > 0 || selection.member_ids.length > 0);
          })
          .map((task) => createEventTaskAssignment(created.id, task.id, taskAssignments[task.id]))
      );
    } catch (err) {
      setError(
        `Event created but one or more task assignments could not be saved${err instanceof Error ? `: ${err.message}` : "."}`
      );
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
      reconcileRsvpNudges(freshEvents).catch((err) => console.warn("Failed to reconcile RSVP nudges:", err));
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
    <ScrollView contentContainerStyle={[styles.container, themed.container]}>
      <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
        <Text style={[styles.backLinkText, themed.backLinkText]}>‹ Back</Text>
      </Pressable>

      <Text style={[styles.label, themed.label]}>Name</Text>
      <TextInput
        style={[styles.input, themed.input]}
        value={name}
        onChangeText={setName}
        editable={!isSubmitting}
        placeholderTextColor={colors.textMuted}
        testID="create-event-name"
      />

      <Text style={[styles.label, themed.label]}>Event Type</Text>
      <View style={styles.optionsRow}>
        {eventTypes.map((type) => (
          <Pressable
            key={type.id}
            style={[
              styles.optionButton,
              themed.optionButton,
              eventTypeId === type.id && [styles.optionButtonSelected, themed.optionButtonSelected],
            ]}
            onPress={() => setEventTypeId(type.id)}
            disabled={isSubmitting}
            testID={`create-event-type-${type.id}`}
          >
            <Text style={[styles.optionText, themed.optionText, eventTypeId === type.id && styles.optionTextSelected]}>
              {type.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, themed.label]}>Start</Text>
      <Pressable
        style={[styles.input, themed.input]}
        onPress={() => openDateTimePicker("start")}
        disabled={isSubmitting}
        testID="create-event-start"
      >
        <Text style={themed.inputText}>{formatDateTime(startDatetime)}</Text>
      </Pressable>

      {isAnnouncement ? (
        // DIP-FP-191-mobile-adj-3: mirrors web's own EventForm.tsx —
        // computed as start + 1 day, matching insert_event_with_audit's own
        // forced value server-side, not user-editable.
        <Text style={[styles.label, themed.label]}>
          End: {startDatetime ? formatDateTime(new Date(startDatetime.getTime() + 24 * 60 * 60 * 1000)) : "Set a start date first"}
        </Text>
      ) : (
        <>
          <Text style={[styles.label, themed.label]}>End</Text>
          <Pressable
            style={[styles.input, themed.input]}
            onPress={() => openDateTimePicker("end")}
            disabled={isSubmitting}
            testID="create-event-end"
          >
            <Text style={themed.inputText}>{formatDateTime(endDatetime)}</Text>
          </Pressable>
        </>
      )}

      {isAnnouncement ? (
        <>
          <Text style={[styles.label, themed.label]}>Announcement Body</Text>
          <TextInput
            style={[styles.input, themed.input, styles.multilineInput]}
            value={announcementBody}
            onChangeText={setAnnouncementBody}
            multiline
            editable={!isSubmitting}
            placeholderTextColor={colors.textMuted}
            testID="create-event-announcement-body"
          />
        </>
      ) : null}

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
        <View style={[styles.iosPickerCard, themed.iosPickerCard]}>
          <View style={[styles.iosPickerHeader, themed.iosPickerHeader]}>
            <Pressable onPress={() => setShowIosPicker(null)} testID="ios-picker-cancel">
              <Text style={[styles.linkText, themed.linkText]}>Cancel</Text>
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
              <Text style={[styles.doneText, themed.doneText]}>Done</Text>
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

      {!isAnnouncement && (
        <>
          <Text style={[styles.label, themed.label]}>RSVP Closure Override (days, optional)</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={rsvpClosureDays}
            onChangeText={setRsvpClosureDays}
            keyboardType="number-pad"
            editable={!isSubmitting}
            placeholder="Blank = tenant default"
            placeholderTextColor={colors.textMuted}
            testID="create-event-rsvp-closure-days"
          />

          {/* DIP-FP-189-adj-1: mirrors web's EventForm.tsx placement/copy —
              plain Switch, no design-system precedent exists for this yet
              in this codebase. */}
          <View style={styles.switchRow}>
            <Text style={[styles.label, themed.label, styles.switchLabel]}>
              Guests Allowed{" "}
              <Text style={[styles.switchCaption, themed.switchCaption]}>
                (members can RSVP with a guest headcount)
              </Text>
            </Text>
            <Switch
              value={guestsAllowed}
              onValueChange={setGuestsAllowed}
              disabled={isSubmitting}
              testID="create-event-guests-allowed"
            />
          </View>

          <Text style={[styles.label, themed.label]}>Location Name</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={locationName}
            onChangeText={setLocationName}
            editable={!isSubmitting}
            placeholderTextColor={colors.textMuted}
            testID="create-event-location-name"
          />

          <Text style={[styles.label, themed.label]}>Location Address</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={locationAddress}
            onChangeText={setLocationAddress}
            editable={!isSubmitting}
            placeholderTextColor={colors.textMuted}
            testID="create-event-location-address"
          />

          <Text style={[styles.label, themed.label]}>Location URL (optional)</Text>
          <TextInput
            style={[styles.input, themed.input]}
            value={locationUrl}
            onChangeText={setLocationUrl}
            editable={!isSubmitting}
            autoCapitalize="none"
            placeholderTextColor={colors.textMuted}
            testID="create-event-location-url"
          />

          <Text style={[styles.label, themed.label]}>Online Meeting (optional)</Text>
          <View style={styles.optionsRow}>
            {(["none", "zoom", "other"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.optionButton,
                  themed.optionButton,
                  meetingMode === mode && [styles.optionButtonSelected, themed.optionButtonSelected],
                ]}
                onPress={() => setMeetingMode(mode)}
                disabled={isSubmitting}
                testID={`create-event-meeting-mode-${mode}`}
              >
                <Text style={[styles.optionText, themed.optionText, meetingMode === mode && styles.optionTextSelected]}>
                  {mode === "none" ? "None" : mode === "zoom" ? "Zoom Account" : "Other Platform"}
                </Text>
              </Pressable>
            ))}
          </View>

          {meetingMode === "zoom" ? (
            <MeetingResourcePicker
              resourceLabel={onlineMeetingResourceLabel}
              selectedResourceId={onlineMeetingResourceId}
              onChange={(id, label) => {
                setOnlineMeetingResourceId(id);
                setOnlineMeetingResourceLabel(label);
              }}
              themed={themed}
            />
          ) : null}

          {meetingMode === "other" ? (
            <>
              <Text style={[styles.label, themed.label]}>Platform Name</Text>
              <TextInput
                style={[styles.input, themed.input]}
                value={onlineMeetingPlatformLabel}
                onChangeText={setOnlineMeetingPlatformLabel}
                editable={!isSubmitting}
                placeholder="e.g. Google Meet"
                placeholderTextColor={colors.textMuted}
                testID="create-event-meeting-platform-label"
              />

              <Text style={[styles.label, themed.label]}>Meeting Link</Text>
              <TextInput
                style={[styles.input, themed.input]}
                value={onlineMeetingUrl}
                onChangeText={setOnlineMeetingUrl}
                editable={!isSubmitting}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
                testID="create-event-meeting-url"
              />
            </>
          ) : null}
        </>
      )}

      {isAnnouncement ? (
        // DIP-FP-191-mobile-adj-3: purely informational — the real audience
        // is always server-forced to the tenant's Everyone group regardless
        // of what's shown here, same as web's own EventForm.tsx.
        <>
          <Text style={[styles.label, themed.label]}>Target</Text>
          <Text style={themed.inputText}>Everyone (this community)</Text>
        </>
      ) : (
        <GroupMemberChipPicker label="Target Audience" value={target} onChange={setTarget} />
      )}

      {!isAnnouncement && (
        <>
          <FormationTalkPicker
            talkLabel={talkLabel}
            onChange={(id, label) => {
              setTalkId(id);
              setTalkLabel(label);
            }}
            themed={themed}
          />

          <Text style={[styles.label, themed.label]}>Tasks</Text>
          {displayedTasks.map((task) => (
            <GroupMemberChipPicker
              key={task.id}
              label={`${task.name} (optional)`}
              value={taskAssignments[task.id] ?? EMPTY_SELECTION}
              onChange={(selection) => setTaskAssignment(task.id, selection)}
              individualOnly={task.individual_only}
            />
          ))}

          {availableToAddTasks.length > 0 ? (
            <>
              <Text style={[styles.label, themed.label]}>Add Task</Text>
              <View style={styles.optionsRow}>
                {availableToAddTasks.map((task) => (
                  <Pressable
                    key={task.id}
                    style={[styles.optionButton, themed.optionButton]}
                    onPress={() => setAddedTaskIds((prev) => [...prev, task.id])}
                    disabled={isSubmitting}
                    testID={`create-event-add-task-${task.id}`}
                  >
                    <Text style={[styles.optionText, themed.optionText]}>{task.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}

      {error ? (
        <Text style={[styles.error, themed.error]} testID="create-event-error">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[styles.submitButton, themed.submitButton, isSubmitting && styles.buttonDisabled]}
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  switchLabel: {
    flex: 1,
    marginTop: 0,
    marginRight: 12,
  },
  switchCaption: {
    fontSize: 13,
    fontWeight: "400",
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
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
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
  optionRowSelected: {
    backgroundColor: "#eff6ff",
  },
  optionLabelSelected: {
    color: "#2563eb",
    fontWeight: "700",
  },
});
