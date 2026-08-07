import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
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

interface SwipeableTabScreenProps {
  children: ReactNode;
}

// DIP-FP-194-mobile: thin wrapper — no visual sliding transition (explicit
// non-goal), just a gesture recognizer that calls the same
// navigation.navigate() a tap on the adjacent tab already triggers. No
// react-native-reanimated dependency: react-native-gesture-handler's
// Gesture API runs .onEnd()'s callback as a plain JS-thread function
// without Reanimated configured (Reanimated is only needed to also drive
// UI-thread-animated values from a gesture, not used here).
export function SwipeableTabScreen({ children }: SwipeableTabScreenProps) {
  const { onSwipeLeft, onSwipeRight } = useSwipeTabNavigation();

  const panGesture = Gesture.Pan()
    .activeOffsetX([-HORIZONTAL_ACTIVATION_OFFSET, HORIZONTAL_ACTIVATION_OFFSET])
    .failOffsetY([-VERTICAL_FAIL_OFFSET, VERTICAL_FAIL_OFFSET])
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      const qualifies =
        Math.abs(translationX) > SWIPE_DISTANCE_THRESHOLD || Math.abs(velocityX) > SWIPE_VELOCITY_THRESHOLD;
      if (!qualifies) return;

      // Swipe left (finger moves right-to-left, negative translationX)
      // advances forward — same direction convention as iOS home-screen
      // paging/Stories.
      if (translationX < 0) {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
