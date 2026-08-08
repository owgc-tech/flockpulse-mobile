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
  const { onSwipeLeft, onSwipeRight } = useSwipeTabNavigation();
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
  useEffect(() => {
    if (isFocused) {
      translateX.value = 0;
    }
  }, [isFocused, translateX]);

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
      const offscreenTarget = isSwipeLeft ? -screenWidth : screenWidth;

      translateX.value = withTiming(offscreenTarget, { duration: SLIDE_OUT_DURATION_MS }, (finished) => {
        if (!finished) return;
        // FP-195-mobile-adj-1: no longer resets translateX here — the
        // isFocused effect above is the single source of truth for
        // resetting position now (see its own comment for why the reset
        // needed to move off this completion callback).
        if (isSwipeLeft) {
          runOnJS(onSwipeLeft)();
        } else {
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
