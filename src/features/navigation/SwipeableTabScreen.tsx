import { useEffect, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
// FP-195-mobile-adj-1: unlike useNavigation/useNavigationState (FP-179's
// finding — genuinely no top-level expo-router export), useIsFocused is
// re-exported from expo-router's own public entry point (build/exports.ts)
// — confirmed live, and the vendored path's own .d.ts marks it
// `@deprecated Import useIsFocused from 'expo-router' instead`. This repo
// already imports useFocusEffect from "expo-router" in three tab screens
// (app/(app)/(tabs)/index.tsx, my-tasks/index.tsx, self-report/index.tsx) —
// this follows that same established convention rather than the deep
// react-navigation/native path the DIP's Grounding Check assumed.
import { useIsFocused } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { getLastSwipeDirection, setLastSwipeDirection } from "@/src/features/navigation/lastSwipeDirectionStore";
import { useSwipeTabNavigation } from "@/src/features/navigation/useSwipeTabNavigation";

// DIP-FP-194-mobile: activeOffsetX/failOffsetY are gesture-handler's own
// mechanism for resolving the "is this a horizontal swipe or a vertical
// scroll" ambiguity — a Pan gesture only activates once the finger crosses
// activeOffsetX horizontally; it fails (yielding to the screen's own
// ScrollView/FlatList/SectionList scrolling, which every tab screen this
// wraps has) if it crosses failOffsetY vertically first. Distance/velocity
// thresholds below are for the actual swipe-vs-tap decision once the pan
// gesture has already activated.
const HORIZONTAL_ACTIVATION_OFFSET = 20;
const VERTICAL_FAIL_OFFSET = 20;
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;
// FP-195-mobile: not specified by the DIP — chosen to read as a deliberate
// page transition (iOS/Android's own default screen-transition durations
// fall in this same ~200-300ms range) without feeling sluggish on a repeat
// swipe.
const SLIDE_OUT_DURATION_MS = 220;

interface SwipeableTabScreenProps {
  children: ReactNode;
}

// DIP-FP-195-mobile: translateX now drives a real visual transition —
// .onUpdate() tracks the finger live, .onEnd() either finishes the slide
// off-screen (qualifying swipe) or springs back to 0 (non-qualifying).
// navigation.navigate() (via onSwipeLeft/onSwipeRight, unchanged from
// FP-194) fires only once the off-screen animation completes — same
// navigation call as before, just sequenced after the visual transition
// instead of instantly. runOnJS is required because the gesture callbacks
// and withTiming's completion callback all run on the UI thread as
// worklets, but navigation.navigate() is JS-thread-only.
export function SwipeableTabScreen({ children }: SwipeableTabScreenProps) {
  const { onSwipeLeft, onSwipeRight, canSwipeLeft, canSwipeRight } = useSwipeTabNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const isFocused = useIsFocused();

  // FP-195-mobile-adj-1: resets on focus rather than immediately after the
  // outgoing animation's own completion callback fires — tab screens stay
  // mounted (not unmounted) when inactive, so a reset tied only to "the
  // navigation call was queued" isn't coordinated with when the tab switch
  // has actually visually finished, producing a flash of this screen
  // snapping back to center while still on top. Resetting on this screen's
  // own focus instead guarantees it's always at rest by the time it's
  // actually visible again, regardless of how or when it was last left.
  //
  // FP-195-mobile-adj-2: a null lastSwipeDirection means this focus wasn't
  // caused by a swipe (a plain tab-bar tap, or initial app load) — jump to
  // 0 with no animation, unchanged from adj-1. A non-null direction means
  // this screen is the swipe's destination: it starts off-screen on the
  // opposite side from the direction the outgoing screen slid (a
  // "left"-caused transition means the outgoing screen went left, so this
  // one arrives from the right, at +screenWidth) and slides in to 0,
  // in sync with the outgoing screen's own slide. Cleared immediately after
  // reading so a later plain tap doesn't replay a stale slide-in.
  useEffect(() => {
    if (!isFocused) return;

    const direction = getLastSwipeDirection();
    if (direction === null) {
      translateX.value = 0;
      return;
    }

    setLastSwipeDirection(null);
    translateX.value = direction === "left" ? screenWidth : -screenWidth;
    translateX.value = withTiming(0, { duration: SLIDE_OUT_DURATION_MS });
  }, [isFocused, translateX, screenWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-HORIZONTAL_ACTIVATION_OFFSET, HORIZONTAL_ACTIVATION_OFFSET])
    .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      const qualifies =
        Math.abs(translationX) > SWIPE_DISTANCE_THRESHOLD || Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (!qualifies) {
        translateX.value = withSpring(0);
        return;
      }

      // Swipe left (finger moves right-to-left, negative translationX)
      // advances forward — same direction convention as iOS home-screen
      // paging/Stories, unchanged from FP-194.
      const isSwipeLeft = translationX < 0;

      // FP-195-mobile-adj-2: a qualifying swipe at either boundary has no
      // adjacent tab to land on — onSwipeLeft/onSwipeRight would silently
      // no-op internally (see useSwipeTabNavigation.ts's own boundary
      // check), so playing the off-screen animation here would leave this
      // screen stuck fully off-screen with no focus change ever coming to
      // trigger adj-1's reset. Treated exactly like a non-qualifying swipe
      // instead — spring back, no animation, no navigation call.
      if ((isSwipeLeft && !canSwipeLeft) || (!isSwipeLeft && !canSwipeRight)) {
        translateX.value = withSpring(0);
        return;
      }

      const offscreenTarget = isSwipeLeft ? -screenWidth : screenWidth;

      translateX.value = withTiming(offscreenTarget, { duration: SLIDE_OUT_DURATION_MS }, (finished) => {
        if (!finished) return;
        // FP-195-mobile-adj-1: no longer resets translateX here — the
        // isFocused effect above is the single source of truth for
        // resetting position now (see its own comment for why the reset
        // needed to move off this completion callback).
        //
        // FP-195-mobile-adj-2: records which direction caused this
        // transition before navigating, so the incoming screen's own
        // isFocused effect (above) knows which edge to slide in from.
        if (isSwipeLeft) {
          runOnJS(setLastSwipeDirection)("left");
          runOnJS(onSwipeLeft)();
        } else {
          runOnJS(setLastSwipeDirection)("right");
          runOnJS(onSwipeRight)();
        }
      });
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
