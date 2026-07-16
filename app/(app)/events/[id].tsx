import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/src/lib/api";
import { useSession } from "@/src/features/auth/hooks/useSession";
import {
  getEventById,
  getEventRoster,
  listMeetingResources,
  submitRsvp,
} from "@/src/features/events/services/events.service";
import { fetchMyProfile } from "@/src/features/members/services/myProfile.service";
import { fetchReminderContext } from "@/src/features/notifications/services/reminderContent.service";
import { RsvpControls } from "@/src/features/events/components/RsvpControls";
import { RosterList } from "@/src/features/events/components/RosterList";
import { getMapUrl } from "@/src/features/events/utils";
import type {
  EventDetail,
  EventTargetSelector,
  MeetingResource,
  MyEvent,
  RosterEntry,
  RsvpStatus,
} from "@/src/features/events/types";
import type { EventReminderFormation } from "@/src/features/notifications/types";

// GET /api/members / GET /api/groups response rows, filtered down via
// ?id= — same shape as MemberGroupPicker's unfiltered fetch of the same two
// endpoints, kept local and untyped-for-export for the same reason: this
// screen is the only consumer of the filtered form.
interface MemberLookupRow {
  id: string;
  first_name: string;
  last_name: string;
}

interface GroupLookupRow {
  id: string;
  name: string;
}

// Resolves food_assignment's group_ids/member_ids into display names.
// Each id is looked up independently via Promise.allSettled (not
// Promise.all) so one bad id — e.g. a group that's since been soft-deleted —
// only drops that one name from the list rather than failing the whole
// Food Assignment section.
async function resolveFoodAssignmentNames(assignment: EventTargetSelector): Promise<string> {
  const groupIds = assignment.group_ids ?? [];
  const memberIds = assignment.member_ids ?? [];

  const [groupSettled, memberSettled] = await Promise.all([
    Promise.allSettled(groupIds.map((id) => apiFetch<GroupLookupRow>(`/api/groups?id=${id}`))),
    Promise.allSettled(memberIds.map((id) => apiFetch<MemberLookupRow>(`/api/members?id=${id}`))),
  ]);

  const groupNames = groupSettled
    .filter((r): r is PromiseFulfilledResult<GroupLookupRow> => r.status === "fulfilled")
    .map((r) => r.value?.name)
    .filter((name): name is string => Boolean(name));

  const memberNames = memberSettled
    .filter((r): r is PromiseFulfilledResult<MemberLookupRow> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((row): row is MemberLookupRow => Boolean(row))
    .map((row) => `${row.first_name} ${row.last_name}`);

  return [...groupNames, ...memberNames].join(", ");
}

// This screen's local state needs both MyEvent's rsvp_status/rsvp_reason
// (present on the initial route-param object, which is MyEvent-shaped) and
// EventDetail's talk_id/created_by_member_id (only present after the
// fresh-fetch below resolves and merges in) — EventDetail itself represents
// the endpoint's actual complete, always-present response shape (see its doc
// comment), so those two fields are Partial'd here to reflect that this
// component's own state may not have them yet.
type ScreenEvent = MyEvent & Partial<Pick<EventDetail, "talk_id" | "created_by_member_id">>;

function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${startTime} – ${endTime}`;
}

// Member-branch read-only copy when RSVP controls aren't editable
// (effective_status !== 'SCHEDULED'): distinguishes "hasn't opened yet" from
// "already closed" rather than showing one generic message either way.
function readOnlyRsvpLabel(event: ScreenEvent): string {
  if (event.rsvp_status === "YES") return "You responded: Going";
  if (event.rsvp_status === "NO") {
    return event.rsvp_reason ? `You responded: Not going — ${event.rsvp_reason}` : "You responded: Not going";
  }
  return event.effective_status === "DRAFT" ? "Not yet responded" : "RSVP closed";
}

export default function EventDetailScreen() {
  const params = useLocalSearchParams<{ id: string; event?: string }>();
  const { session } = useSession();
  // Every event here is one the viewer is personally an attendee of, so
  // RSVP is always shown; roster is additionally shown to anyone who isn't
  // a plain Member (Leader scoped to their own assigned members, Admin
  // seeing everyone — both already enforced server-side). Guarded on role
  // being known yet (not just "!== MEMBER") so it defaults to hidden while
  // this screen's own useSession() call is still resolving, rather than
  // briefly flashing true for a Member on first render.
  const role = session?.user.app_metadata?.role;
  const showRoster = role !== undefined && role !== "MEMBER";

  const [event, setEvent] = useState<ScreenEvent | null>(null);
  const [parseError, setParseError] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [prayerLeaderName, setPrayerLeaderName] = useState<string | null>(null);
  const [foodAssignmentNames, setFoodAssignmentNames] = useState<string | null>(null);
  const [formationTalk, setFormationTalk] = useState<EventReminderFormation | null>(null);
  const [meetingResource, setMeetingResource] = useState<MeetingResource | null>(null);
  // Distinguishes "still fetching" from "fetched, nothing to show" (e.g. the
  // prayer leader lookup rejected outright) — without this, a rejected
  // lookup would leave its section reading "Loading…" forever instead of
  // settling on a final answer.
  const [contextLookupsSettled, setContextLookupsSettled] = useState(false);

  useEffect(() => {
    if (!params.event) {
      setParseError(true);
      return;
    }
    try {
      // The initial object is MyEvent-shaped (list-screen tap or
      // notification payload) — it never has created_by_member_id, only the
      // fresh-fetch below does. Cast is safe: it's simply absent until the
      // merge below adds it.
      setEvent(JSON.parse(params.event) as ScreenEvent);
    } catch {
      setParseError(true);
    }
  }, [params.event]);

  // DIP-FP-115-mobile-nav-calendar-edit: needed for the ownership half of
  // the Edit-button gate below. No caching, same rationale as Avatar.tsx's
  // fetchMyProfile() call — this screen is opened infrequently enough that
  // an always-fresh network hit is cheap and avoids a stale-role/group bug
  // class entirely.
  useEffect(() => {
    fetchMyProfile()
      .then((profile) => setMyProfileId(profile.id))
      .catch(() => {
        // Leave canEdit's ownership branch resolved as "unknown" rather
        // than blocking the whole screen over a failed profile fetch.
      });
  }, []);

  // The initial event object came baked into a notification's data payload
  // at scheduling time (or route params from the list screen) — it can be
  // stale if the event was edited/cancelled since. Fresh-fetch on every
  // focus (not just mount) and merge over what's already rendered, so
  // returning to this screen after editing elsewhere (e.g. the Edit form,
  // which navigates back via router.back() rather than a fresh push) also
  // picks up the change — FP-120-mobile-adj-1: a mount-only fetch missed
  // that return-from-edit case. getEventById() doesn't return
  // rsvp_status/rsvp_reason (only /api/events/mine does), so spreading it
  // over the previous state can't clobber those fields even though it runs
  // after the initial parse.
  useFocusEffect(
    useCallback(() => {
      if (!params.id) return;
      getEventById(params.id)
        .then((fresh) => {
          setEvent((prev) => (prev ? { ...prev, ...fresh } : prev));
        })
        .catch((err) => {
          console.warn("Failed to fresh-fetch event:", err);
        });
    }, [params.id])
  );

  // Prayer Leader / Food Assignment / Formation Talk are three independent
  // lookups — Promise.allSettled (not sequential awaits) so one failing
  // (e.g. a soft-deleted group behind food_assignment) can't blank the
  // other two, same defensive pattern as myProfileId above. talk_id isn't
  // present on the initial MyEvent-shaped object (only after the
  // fresh-fetch merge above resolves), so this naturally re-runs once that
  // merge lands and picks up the Formation Talk lookup at that point.
  useEffect(() => {
    if (!event) return;
    setContextLookupsSettled(false);

    Promise.allSettled([
      event.prayer_leader_member_id
        ? apiFetch<MemberLookupRow>(`/api/members?id=${event.prayer_leader_member_id}`)
        : Promise.resolve(null),
      event.food_assignment ? resolveFoodAssignmentNames(event.food_assignment) : Promise.resolve(null),
      event.talk_id ? fetchReminderContext(event.id) : Promise.resolve(null),
      // Only the id is on the event itself — the display name and actual
      // join_url live on the tracked resource, same reasoning as the
      // Prayer Leader/Food Assignment id-to-name lookups above.
      event.online_meeting_resource_id
        ? listMeetingResources().then(
            (resources) => resources.find((r) => r.id === event.online_meeting_resource_id) ?? null
          )
        : Promise.resolve(null),
    ]).then(([prayerResult, foodResult, talkResult, meetingResourceResult]) => {
      if (prayerResult.status === "fulfilled" && prayerResult.value) {
        const member = prayerResult.value;
        setPrayerLeaderName(`${member.first_name} ${member.last_name}`);
      }
      if (foodResult.status === "fulfilled" && foodResult.value) {
        setFoodAssignmentNames(foodResult.value);
      }
      if (talkResult.status === "fulfilled" && talkResult.value?.formation) {
        setFormationTalk(talkResult.value.formation);
      }
      if (meetingResourceResult.status === "fulfilled" && meetingResourceResult.value) {
        setMeetingResource(meetingResourceResult.value);
      }
      setContextLookupsSettled(true);
    });
  }, [
    event?.id,
    event?.prayer_leader_member_id,
    event?.food_assignment,
    event?.talk_id,
    event?.online_meeting_resource_id,
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rosterRefreshTrigger, setRosterRefreshTrigger] = useState(0);

  // Pull-to-refresh needs to re-trigger every independent piece of this
  // screen's data, not just the event: re-fetching and merging the event
  // object already covers the Prayer Leader/Food Assignment/Formation Talk
  // lookups (their own useEffect above is keyed on the relevant event
  // fields, so it re-runs automatically if those actually changed) — but
  // Roster lives in its own nested component with its own fetch, so it
  // needs an explicit trigger bump to know to reload.
  const handleRefresh = useCallback(async () => {
    if (!params.id) return;
    setIsRefreshing(true);
    try {
      const fresh = await getEventById(params.id);
      setEvent((prev) => (prev ? { ...prev, ...fresh } : prev));
    } catch (err) {
      console.warn("Failed to refresh event:", err);
    } finally {
      setIsRefreshing(false);
    }
    setRosterRefreshTrigger((t) => t + 1);
  }, [params.id]);

  if (parseError || !event) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
          <Text style={styles.backLinkText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.error}>
          {parseError ? "Couldn't open this event — please go back and try again." : "Loading…"}
        </Text>
      </View>
    );
  }

  // DIP-FP-115-mobile-nav-calendar-edit Grounding Check formula: Admin-tier
  // can edit any event; everyone else only their own. created_by_member_id
  // is undefined until the fresh-fetch above resolves, and myProfileId is
  // null until its own fetch resolves — canEdit stays false (button hidden,
  // not flashed-then-hidden) until both are known, same defensive pattern
  // used for showRoster above. Real enforcement is server-side regardless
  // (see updateEvent's doc comment) — this only controls whether the button
  // renders.
  const isAdminTier = role === "ADMIN";
  const canEdit =
    role !== undefined &&
    event.created_by_member_id !== undefined &&
    myProfileId !== null &&
    (isAdminTier || event.created_by_member_id === myProfileId);

  const handleEditPress = () => {
    router.push({
      pathname: "/(app)/events/[id]/edit",
      params: { id: event.id, event: JSON.stringify(event) },
    });
  };

  // Resource-booked meetings resolve their join link/label from the tracked
  // resource (looked up above); freeform-platform meetings already carry
  // both directly on the event.
  const onlineMeetingLink = event.online_meeting_resource_id
    ? (meetingResource?.join_url ?? null)
    : event.online_meeting_url;
  const onlineMeetingLabel = event.online_meeting_resource_id
    ? `Zoom: ${meetingResource?.name ?? "Join Meeting"}`
    : event.online_meeting_platform_label || "Join Meeting";

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={styles.backLink} testID="back-link">
          <Text style={styles.backLinkText}>‹ Back</Text>
        </Pressable>
        {canEdit ? (
          <Pressable style={styles.editButton} onPress={handleEditPress} testID="event-detail-edit">
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.name}>{event.name}</Text>
      <Text style={styles.meta}>{formatDateTimeRange(event.start_datetime, event.end_datetime)}</Text>
      {/* alignSelf: 'flex-start' keeps the tap area sized to the two text
          lines — the ScrollView's contentContainerStyle (this Pressable's
          parent) defaults to alignItems: 'stretch', which would otherwise
          stretch it to the full screen width. */}
      <Pressable
        style={styles.locationPressable}
        onPress={() => Linking.openURL(getMapUrl(event))}
        testID="event-detail-map"
      >
        <Text style={[styles.meta, styles.locationLink]}>{event.location_name}</Text>
        <Text style={[styles.metaSecondary, styles.locationLink]}>{event.location_address}</Text>
      </Pressable>

      {onlineMeetingLink ? (
        <Pressable
          style={styles.locationPressable}
          onPress={() => Linking.openURL(onlineMeetingLink)}
          testID="event-detail-online-meeting"
        >
          <Text style={[styles.meta, styles.locationLink]}>{onlineMeetingLabel}</Text>
        </Pressable>
      ) : event.online_meeting_resource_id ? (
        <Text style={styles.metaSecondary}>
          {contextLookupsSettled ? "Online meeting link not available" : "Loading…"}
        </Text>
      ) : null}

      <View style={styles.divider} />

      {event.prayer_leader_member_id ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Prayer Leader</Text>
          <Text style={styles.fieldValue}>
            {prayerLeaderName ?? (contextLookupsSettled ? "Not available" : "Loading…")}
          </Text>
        </View>
      ) : null}

      {event.food_assignment ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Food Assignment</Text>
          <Text style={styles.fieldValue}>
            {foodAssignmentNames || (contextLookupsSettled ? "Not available" : "Loading…")}
          </Text>
        </View>
      ) : null}

      {/* talk_id is undefined (not yet fetched) briefly before the
          fresh-fetch merge above resolves, then either a string or
          explicit null — only null (confirmed no talk) hides this
          section outright; undefined still renders it in a loading state. */}
      {event.talk_id !== null ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Formation Talk</Text>
          {formationTalk ? (
            <>
              <Text style={styles.fieldValue}>
                {`${formationTalk.course_name} › ${formationTalk.module_name} › ${formationTalk.talk_name}`}
              </Text>
              {formationTalk.talk_description ? (
                <Text style={styles.metaSecondary}>{formationTalk.talk_description}</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.metaSecondary}>
              {contextLookupsSettled ? "Not available" : "Loading…"}
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.divider} />

      <RsvpSection event={event} onEventChange={setEvent} />

      {showRoster ? (
        <>
          <View style={styles.divider} />
          <RosterSection eventId={event.id} refreshTrigger={rosterRefreshTrigger} />
        </>
      ) : null}
    </ScrollView>
  );
}

function RsvpSection({
  event,
  onEventChange,
}: {
  event: ScreenEvent;
  onEventChange: (event: ScreenEvent) => void;
}) {
  const editable = event.effective_status === "SCHEDULED";

  const handleSubmit = async (status: RsvpStatus, reason?: string) => {
    const response = await submitRsvp(event.id, status, reason);
    // Update local state so the screen reflects the new response
    // immediately without a re-fetch (Grounding Check tradeoff: the list
    // screen re-fetches on focus, so this only needs to stay correct for
    // the current mount of this screen).
    onEventChange({
      ...event,
      rsvp_status: response.rsvp_status,
      rsvp_reason: response.rsvp_reason,
    });
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Your RSVP</Text>
      <RsvpControls
        currentStatus={event.rsvp_status}
        editable={editable}
        readOnlyLabel={readOnlyRsvpLabel(event)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function RosterSection({ eventId, refreshTrigger }: { eventId: string; refreshTrigger: number }) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    setError(null);
    try {
      const data = await getEventRoster(eventId);
      setRoster(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster.");
    }
  }, [eventId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster, refreshTrigger]);

  return (
    <View>
      <Text style={styles.sectionTitle}>Invitees</Text>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !roster ? (
        <ActivityIndicator />
      ) : (
        <RosterList entries={roster} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backLink: {
    alignSelf: "flex-start",
  },
  backLinkText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
  },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 24,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
  },
  meta: {
    fontSize: 15,
    color: "#333",
    marginTop: 8,
  },
  metaSecondary: {
    fontSize: 14,
    color: "#777",
    marginTop: 2,
  },
  locationPressable: {
    alignSelf: "flex-start",
  },
  locationLink: {
    color: "#2563eb",
    textDecorationLine: "underline",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ddd",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    color: "#333",
  },
  error: {
    color: "#c0392b",
    fontSize: 15,
    textAlign: "center",
  },
});
